browser.tabs.onUpdated.addListener((tabId, changeInfo, _) => {
    if (changeInfo.url) {
        const pattern = /\/[a-z0-9]{8}$/i;
        if (pattern.test(changeInfo.url)) {
            browser.tabs.sendMessage(tabId, {
                type: "URL_CHANGED",
                newUrl: changeInfo.url
            }).catch(err => console.error(err));
        }
    }
});