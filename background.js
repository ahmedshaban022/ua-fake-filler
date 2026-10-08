// Service worker: wires the toolbar command, context menu, and keyboard
// shortcut to the fill/undo helpers. No state is kept here.

import { fillTab, undoTab } from './shared/inject.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ua-ff-fill',
    title: 'Fill form with fake data',
    contexts: ['page', 'editable']
  });
  chrome.contextMenus.create({
    id: 'ua-ff-undo',
    title: 'Undo UA Fake Filler',
    contexts: ['page', 'editable']
  });
});

async function activeTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] && tabs[0].id;
}

async function doFill() {
  const tabId = await activeTabId();
  if (tabId == null) return null;
  return fillTab(tabId).catch(() => null);
}

async function doUndo() {
  const tabId = await activeTabId();
  if (tabId == null) return null;
  return undoTab(tabId).catch(() => null);
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'fill-page') doFill();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'ua-ff-fill') doFill();
  if (info.menuItemId === 'ua-ff-undo') doUndo();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'ua-ff:fill') {
    doFill().then(sendResponse);
    return true;
  }
  if (msg && msg.type === 'ua-ff:undo') {
    doUndo().then(sendResponse);
    return true;
  }
  return undefined;
});
