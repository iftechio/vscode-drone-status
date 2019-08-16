import * as vscode from 'vscode'
import axios from 'axios'
import * as EventSource from 'eventsource'
const fs = require('fs')
const path = require('path')

let droneStatusItem: vscode.StatusBarItem
let message: any = {}
let droneConfig = {
  host: '',
  namespace: '',
  name: '',
  accessToken: ''
}

let es: EventSource
const droneConfigurationFileName = '.drone.status'
export function activate(context: vscode.ExtensionContext) {
  const { subscriptions } = context
  let hasDroneInRoot = false
  // register a command that is invoked when the status bar
  // item is selected
  const commandId = 'drone.openInDrone'
  subscriptions.push(vscode.commands.registerCommand(commandId,() => {
    if (!hasDroneInRoot) {
      vscode.window.showWarningMessage("The project is not enabled for Drone. Missing .drone.status file.")
      return
    }

    if (!getCurrentBasePath() || !fs.existsSync(path.join(getCurrentBasePath(),droneConfigurationFileName))) {
      vscode.window.showWarningMessage("The current project is not enabled for Drone.")
      return
    }

    vscode.env.openExternal(getUrl())
  }))

  // create a new status bar item that we can now manage
  droneStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,100)
  droneStatusItem.command = commandId
  subscriptions.push(droneStatusItem)

  // register some listener that make sure the status bar 
  // item always up-to-date
  subscriptions.push(vscode.workspace.onDidChangeConfiguration((configuration) => {
    console.log(configuration.affectsConfiguration('drone'))
    const affected = configuration.affectsConfiguration('drone')
    if (affected) {
      initDroneStatus()
    }
  }))

  subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
    console.log(document)
    if (document.fileName.endsWith(droneConfigurationFileName)) {
      initDroneStatus()
    }
  }))

  subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(e => {
    initDroneStatus()
  }))

  initDroneStatus()
}

function hasDroneInAnyRoot(): boolean {

  if (!vscode.workspace.workspaceFolders) {
    return false;
  }

  let hasAny: boolean = false;

  // for (let index = 0; index < vscode.workspace.workspaceFolders.length; index++) {
  for (const element of vscode.workspace.workspaceFolders) {
    // const element: vscode.WorkspaceFolder = vscode.workspace.workspaceFolders[index];
    hasAny = fs.existsSync(path.join(element.uri.fsPath,droneConfigurationFileName));
    if (hasAny) {
      return hasAny;
    }
  }

  return hasAny;
}

function getUrl() {
  const settings = JSON.parse(fs.readFileSync(path.join(getCurrentBasePath(),".drone.status")).toString())
  return vscode.Uri.parse(settings.url)
}

function initDroneStatus() {
  if (!hasDroneInAnyRoot()) {
    return
  }
  const accessToken = vscode.workspace.getConfiguration("drone").get("accessToken",'')
  if (!accessToken) {
    vscode.window.showWarningMessage('No token found for Drone.')
    return
  }
  const [host,namespace,name] = getUrl().toString().replace(/https?:\/\//g,'').split('/')
  droneConfig = {
    host,namespace,name,accessToken
  }
  if (!host || !namespace || !name) {
    vscode.window.showWarningMessage('Drone Status fail to start due to invalid params, please check the configuration.')
    return
  }
  connectToEventSource()
  updateStatusBarItem()
  fetchLastBuildInfo()
}

function connectToEventSource() {
  if (es) {
    es.close()
  }
  es = new EventSource(`https://${droneConfig.host}/api/stream?access_token=${droneConfig.accessToken}`)
  es.onmessage = ({ data,type }) => {
    if (type !== 'message') return
    console.log('message')
    const parsedMessage = JSON.parse(data)
    console.log(parsedMessage.build.status)
    if (parsedMessage.namespace === droneConfig.namespace && parsedMessage.name === droneConfig.name) {
      message = parsedMessage
    }
    notityUser()
    updateStatusBarItem()
  }
  es.onopen = () => {
    console.log('open')
  }
  es.onerror = (err) => {
    console.log('error',err)
  }
}

function notityUser() {
  const build = message.build
  if (!build) {
    return
  }
  const status = build.status
  const buildNumber = build.number
  if (status === 'running') {
    // TODO: show progress bar instead of `showInformationMessage`
    // vscode.window.showInformationMessage(`Drone: Running (#${buildNumber})`)
  } else if (status === 'success') {
    vscode.window.showInformationMessage(`Drone: Build succeeded (#${buildNumber})`)
  } else if (status === 'failed') {
    vscode.window.showWarningMessage(`Drone: Build failed (#${buildNumber})`)
  }
}

function getCurrentBasePath(): string | undefined {
  if (!vscode.workspace.workspaceFolders) {
    return undefined
  }

  if (!vscode.window.activeTextEditor) {
    if (vscode.workspace.workspaceFolders.length === 1) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath
    } else {
      return undefined
    }
  }
  const uri = vscode.window.activeTextEditor.document.uri
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  return folder ? folder.uri.fsPath : undefined
}

async function fetchLastBuildInfo() {
  const lastBuild = await axios.get(`https://${droneConfig.host}/api/repos/${droneConfig.namespace}/${droneConfig.name}/builds?access_token=${droneConfig.accessToken}`)
  message.build = lastBuild.data[0]
  updateStatusBarItem()
}

function updateStatusBarItem(): void {
  const build = message.build
  if (!build) {
    droneStatusItem.text = '$(gear~spin) Drone: initing...'
    droneStatusItem.show()
    return
  }
  const status = build.status
  const buildNumber = build.number
  if (status === 'running') {
    droneStatusItem.text = `$(gear~spin) Drone: Running (#${buildNumber})`
  } else if (status === 'success') {
    droneStatusItem.text = `$(check) Drone: Success (#${buildNumber})`
  } else if (status === 'failed') {
    droneStatusItem.text = `$(x) Drone: Fail (#${buildNumber})`
  }
  droneStatusItem.show()
}
