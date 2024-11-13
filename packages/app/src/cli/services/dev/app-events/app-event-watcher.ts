/* eslint-disable tsdoc/syntax */
import {OutputContextOptions, startFileWatcher} from './file-watcher.js'
import {ESBuildContextManager} from './app-watcher-esbuild.js'
import {handleWatcherEvents} from './app-event-watcher-handler.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir, rmdir} from '@shopify/cli-kit/node/fs'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import EventEmitter from 'events'

/**
This is the entry point to start watching events in an app. This process has 3 steps:
1. The file system watcher (file-watcher.ts) will detect changes in the file system and emit events.
2. The app-event-watcher (this file) will receive the events and process them, reloading the app if necessary.
3. The consumer of the processed events will receive the updated app and the affected extensions.

Since an extension folder can contain multiple extensions defined in the same toml, all file system events can
potentially affect multiple extensions, an AppEvent will always include an array with all affected extensions.

Examples:
1. A file is updated in an extension folder (/extensions/my_extension/index.js)
 -> file-watcher will emit a `file_updated` event
  -> app-event-watcher will determine that all extensions in the `my_extension` directory are affected
    -> The consumer will receive the updated app and the affected extension(s)

2. A new directory is created in the extensions folder (/extensions/new_extension)
  -> file-watcher will emit a `extension_folder_created` event
    -> app-event-watcher will determine that an extension(s) was(were) created and reload the app
      -> The consumer will receive the updated app and the created extension(s)

3. A directory is removed from the file system (/extensions/my_extension)
  -> file-watcher will emit a `extension_folder_deleted` event
    -> app-event-watcher will determine that all extensions in `my_extension` were deleted and remove them from the app
      -> The consumer will receive the updated app and the deleted extension(s)

4. A toml file is updated (/extensions/my_extension/extension.toml)
  -> file-watcher will emit a `extensions_config_updated` event
    -> app-event-watcher will compare the old and new extensions to determine which were created, deleted or updated
      -> The consumer will receive the updated app and the created, deleted and updated extensions

5. The app.toml is updated
  -> file-watcher will emit a `extensions_config_updated` event
    -> app-event-watcher will compare the old and new config to determine which extensions were created, deleted or updated
      -> The consumer will receive the updated app and the created, deleted and updated extensions
 */

/**
 * The type of the extension event
 *
 * - Updated: The extension was updated
 * - Deleted: The extension was deleted
 * - Created: The extension was created
 */
export enum EventType {
  Updated = 'changed',
  Deleted = 'deleted',
  Created = 'created',
}

export interface ExtensionEvent {
  type: EventType
  extension: ExtensionInstance
}

/**
 * An AppEvent is the result of processing a file system event.
 * It includes the updated app and the affected extensions.
 * The startTime is the time when the initial file-system event was received, it can be used by the consumer
 * to determine how long it took to process the event.
 */
export interface AppEvent {
  app: AppLinkedInterface
  extensionEvents: ExtensionEvent[]
  path: string
  startTime: [number, number]
}

type ExtensionBuildResult = {status: 'ok'; handle: string} | {status: 'error'; error: string; handle: string}

/**
 * App event watcher will emit events when changes are detected in the file system.
 */
export class AppEventWatcher extends EventEmitter {
  buildOutputPath: string
  private app: AppLinkedInterface
  private readonly options: OutputContextOptions
  private readonly appURL?: string
  private readonly esbuildManager: ESBuildContextManager
  private started = false
  private ready = false

  constructor(app: AppLinkedInterface, appURL?: string, options?: OutputContextOptions, buildOutputPath?: string) {
    super()
    this.app = app
    this.appURL = appURL
    this.buildOutputPath = buildOutputPath ?? joinPath(app.directory, '.shopify', 'bundle')
    this.options = options ?? {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}
    this.esbuildManager = new ESBuildContextManager({
      outputPath: this.buildOutputPath,
      dotEnvVariables: this.app.dotenv?.variables ?? {},
      url: this.appURL ?? '',
      ...this.options,
    })
  }

  async start() {
    if (this.started) return
    this.started = true
    // If there is a previous build folder, delete it
    if (await fileExists(this.buildOutputPath)) await rmdir(this.buildOutputPath, {force: true})
    await mkdir(this.buildOutputPath)

    // Start the esbuild bundler for extensions that require it
    await this.esbuildManager.createContexts(this.app.realExtensions.filter((ext) => ext.isESBuildExtension))

    // Initial build of all extensions
    await this.buildExtensions(this.app.realExtensions)

    // Start the file system watcher
    await startFileWatcher(this.app, this.options, (events) => {
      handleWatcherEvents(events, this.app, this.options)
        .then(async (appEvent) => {
          if (!appEvent) return
          this.app = appEvent.app
          if (appEvent.extensionEvents.length === 0) {
            outputDebug('Change detected, but no extensions were affected', this.options.stdout)
            return
          }
          await this.esbuildManager.updateContexts(appEvent)

          // Find affected created/updated extensions and build them
          const createdOrUpdatedExtensions = appEvent.extensionEvents
            .filter((extEvent) => extEvent.type !== EventType.Deleted)
            .map((extEvent) => extEvent.extension)

          await this.buildExtensions(createdOrUpdatedExtensions)

          // Find deleted extensions and delete their previous build output
          const deletedExtensions = appEvent.extensionEvents
            .filter((extEvent) => extEvent.type === EventType.Deleted)
            .map((extEvent) => extEvent.extension)
          await this.deleteExtensionsBuildOutput(deletedExtensions)
          this.emit('all', appEvent)
        })
        .catch((error) => {
          this.options.stderr.write(`Error handling event: ${error.message}`)
        })
    })

    this.ready = true
    this.emit('ready')
  }

  /**
   * Register as a listener for AppEvents.
   *
   * @param listener - The listener function to add
   * @returns The AppEventWatcher instance
   */
  onEvent(listener: (appEvent: AppEvent) => Promise<void> | void) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.addListener('all', listener)
    return this
  }

  /**
   * Register as a listener for the start event.
   * This event is emitted when the watcher is ready to start processing events (after the initial extension build).
   *
   * @param listener - The listener function to add
   * @returns The AppEventWatcher instance
   */
  onStart(listener: () => Promise<void> | void) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.addListener('ready', listener)
    if (this.ready) this.emit('ready')
    return this
  }

  /**
   * Deletes the build output for the given extensions.
   *
   * This is just a cleanup function after detecting that an extension has been deleted.
   */
  private async deleteExtensionsBuildOutput(extensions: ExtensionInstance[]) {
    const promises = extensions.map(async (ext) => {
      const outputPath = joinPath(this.buildOutputPath, ext.getOutputFolderId())
      return rmdir(outputPath, {force: true})
    })
    await Promise.all(promises)
  }

  /**
   * Builds all given extensions.
   * ESBuild extensions will be built using their own ESBuild context, other extensions will be built using the default
   * buildForBundle method.
   */
  private async buildExtensions(extensions: ExtensionInstance[]): Promise<ExtensionBuildResult[]> {
    const promises = extensions.map(async (ext) => {
      return useConcurrentOutputContext({outputPrefix: ext.handle, stripAnsi: false}, async () => {
        try {
          if (this.esbuildManager.contexts[ext.handle]) {
            const result = await this.esbuildManager.contexts[ext.handle]?.rebuild()
            if (result?.errors?.length) throw new Error(result?.errors.map((err) => err.text).join('\n'))
          } else {
            await this.buildExtension(ext)
          }
          return {status: 'ok', handle: ext.handle} as const
          // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
        } catch (error: any) {
          return {status: 'error', error: error.message, handle: ext.handle} as const
        }
      })
    })
    // ESBuild errors are already logged by the ESBuild bundler
    return Promise.all(promises)
  }

  /**
   * Build a single non-esbuild extension using the default buildForBundle method.
   * @param extension - The extension to build
   */
  private async buildExtension(extension: ExtensionInstance): Promise<void> {
    const buildOptions: ExtensionBuildOptions = {
      app: this.app,
      stdout: this.options.stdout,
      stderr: this.options.stderr,
      useTasks: false,
      environment: 'development',
      appURL: this.appURL,
    }
    await extension.buildForBundle(buildOptions, this.buildOutputPath)
  }
}