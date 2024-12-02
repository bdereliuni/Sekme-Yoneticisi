let tabStates = {};
let settings = {
    darkMode: false
};


chrome.runtime.onInstalled.addListener(async () => {
    try {
        
        await chrome.storage.local.set({ 
            categories: {},
            settings: settings
        });

        
        createContextMenus();
        
        console.log('Eklenti başarıyla yüklendi');
    } catch (error) {
        console.error('Eklenti yüklenirken hata:', error);
    }
});


function createContextMenus() {
    chrome.contextMenus.create({
        id: 'openTabManager',
        title: 'Tab Manager Pro\'yu Aç',
        contexts: ['all']
    });
}


chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'openTabManager') {
        chrome.action.openPopup();
    }
});


chrome.runtime.onSuspend.addListener(() => {
    tabStates = {};
}); 