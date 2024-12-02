document.addEventListener('DOMContentLoaded', async function() {
    let categories = {};
    let draggedTab = null;
    let settings = {};

    await loadCategories();
    await loadSettings();
    initializeEventListeners();
    initializeSettingsEventListeners();
    initializeDragAndDrop();
    initializeSearchFunctionality();
});

async function loadCategories() {
    try {
        const result = await chrome.storage.local.get(['categories']);
        categories = result.categories || {};
        await displayCategories();
        updateStats();
    } catch (error) {
        console.error('Kategoriler yüklenirken hata:', error);
    }
}

async function displayCategories() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';

    for (const [categoryName, tabs] of Object.entries(categories)) {
        const categoryElement = createCategoryElement(categoryName, tabs);
        categoryList.appendChild(categoryElement);
    }
}

function createCategoryElement(categoryName, tabs) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category';
    categoryDiv.setAttribute('data-category', categoryName);

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
        <h3>${categoryName}</h3>
        <div class="category-actions">
            <button class="icon-btn open-all-tabs" title="Tüm Sekmeleri Aç">
                <i class="fas fa-external-link-alt"></i>
            </button>
            <button class="icon-btn delete-category" title="Kategoriyi Sil">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    const tabList = document.createElement('div');
    tabList.className = 'tab-list';
    tabs.forEach(tab => {
        const tabElement = createTabElement(tab, categoryName);
        tabList.appendChild(tabElement);
    });

    categoryDiv.appendChild(header);
    categoryDiv.appendChild(tabList);

    header.querySelector('.delete-category').addEventListener('click', () => deleteCategory(categoryName));
    header.querySelector('.open-all-tabs').addEventListener('click', () => openAllTabsInCategory(categoryName));

    return categoryDiv;
}

function createTabElement(tab, categoryName) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-item';
    tabDiv.draggable = true;
    tabDiv.innerHTML = `
        <img class="tab-favicon" src="${tab.favIconUrl || 'images/default-favicon.png'}" alt="Favicon">
        <span class="tab-title">${tab.title}</span>
        <div class="tab-actions">
            <button class="icon-btn remove-tab" title="Sekmeyi Kaldır">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    
    tabDiv.addEventListener('click', (e) => {
        
        if (e.target.closest('.tab-actions') === null) {
            activateTab(tab.id);
        }
    });

    tabDiv.querySelector('.remove-tab').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTabFromCategory(tab.id, categoryName);
    });

    
    tabDiv.addEventListener('dragstart', (e) => {
        draggedTab = { tab, categoryName };
    });

    tabDiv.addEventListener('dragend', () => {
        draggedTab = null;
    });

    return tabDiv;
}


async function activateTab(tabId) {
    try {
        await chrome.tabs.update(tabId, { active: true });
        const tab = await chrome.tabs.get(tabId);
        await chrome.windows.update(tab.windowId, { focused: true });
    } catch (error) {
        console.error('Sekme açılamadı:', error);
    }
}


async function removeTabFromCategory(tabId, categoryName) {
    if (!categories[categoryName]) return;

    categories[categoryName] = categories[categoryName].filter(tab => tab.id !== tabId);
    await saveCategories();
    await displayCategories();
    updateStats();
}


async function createNewCategory() {
    const categoryName = prompt('Yeni kategori adı girin:');
    if (categoryName && !categories[categoryName]) {
        categories[categoryName] = [];
        await saveCategories();
        await displayCategories();
        updateStats();
    }
}


async function deleteCategory(categoryName) {
    if (confirm(`"${categoryName}" kategorisini silmek istediğinize emin misiniz?`)) {
        delete categories[categoryName];
        await saveCategories();
        await displayCategories();
        updateStats();
    }
}


async function openAllTabsInCategory(categoryName) {
    if (!categories[categoryName] || categories[categoryName].length === 0) {
        return;
    }

    try {
        categories[categoryName].forEach(tab => {
            chrome.tabs.create({ url: tab.url });
        });
    } catch (error) {
        console.error('Sekmeler açılırken hata:', error);
    }
}


function sortCategories(criteria = 'alphabetical') {
    const sortedCategories = {};

    const categoryNames = Object.keys(categories);
    if (criteria === 'alphabetical') {
        categoryNames.sort();
    } else if (criteria === 'tabCount') {
        categoryNames.sort((a, b) => categories[b].length - categories[a].length);
    }

    categoryNames.forEach(name => {
        sortedCategories[name] = categories[name];
    });

    categories = sortedCategories;
}


function sortTabs() {
    const sortCriteria = prompt('Sıralama kriteri seçin (alphabetical/tabCount):', 'alphabetical');
    if (sortCriteria === 'alphabetical' || sortCriteria === 'tabCount') {
        sortCategories(sortCriteria);
        displayCategories();
        updateStats();
    } else {
        alert('Geçersiz sıralama kriteri.');
    }
}


async function cleanupTabs() {
    if (confirm('Tüm kategorileri ve sekmeleri silmek istediğinize emin misiniz?')) {
        categories = {};
        await saveCategories();
        await displayCategories();
        updateStats();
    }
}


async function saveCategories() {
    try {
        await chrome.storage.local.set({ categories });
    } catch (error) {
        console.error('Kategoriler kaydedilirken hata:', error);
    }
}


function updateStats() {
    const totalCategories = Object.keys(categories).length;
    let totalTabs = 0;

    for (const tabs of Object.values(categories)) {
        totalTabs += tabs.length;
    }

    document.getElementById('totalCategories').innerText = `${totalCategories} Kategori`;
    document.getElementById('totalTabs').innerText = `${totalTabs} Sekme`;
    document.getElementById('lastSync').innerText = `Son Güncelleme: ${new Date().toLocaleTimeString()}`;
}


function initializeSearchFunctionality() {
    const searchInput = document.getElementById('searchTabs');
    const clearSearchBtn = document.getElementById('clearSearch');

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        filterTabs(query);
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        filterTabs('');
    });
}


function filterTabs(query) {
    const categoryList = document.getElementById('categoryList');
    const categoriesElements = categoryList.getElementsByClassName('category');

    Array.from(categoriesElements).forEach(categoryElement => {
        const categoryName = categoryElement.getAttribute('data-category').toLowerCase();
        const tabList = categoryElement.querySelector('.tab-list');
        const tabs = tabList.getElementsByClassName('tab-item');
        
        
        if (categoryName.includes(query)) {
            categoryElement.style.display = 'block';
            
            Array.from(tabs).forEach(tab => {
                tab.style.display = 'flex';
            });
        } else {
            categoryElement.style.display = 'none';
        }
    });
}


function initializeDragAndDrop() {
    const categoryList = document.getElementById('categoryList');

    categoryList.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    categoryList.addEventListener('drop', async (e) => {
        e.preventDefault();
        const targetCategoryDiv = e.target.closest('.category');
        if (targetCategoryDiv) {
            const targetCategory = targetCategoryDiv.getAttribute('data-category');
            if (draggedTab && targetCategory) {
                
                categories[draggedTab.categoryName] = categories[draggedTab.categoryName].filter(tab => tab.id !== draggedTab.tab.id);
                
                if (!categories[targetCategory]) {
                    categories[targetCategory] = [];
                }
                categories[targetCategory].push(draggedTab.tab);
                await saveCategories();
                await displayCategories();
                updateStats();
                draggedTab = null;
            }
        }
    });
}


async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        settings = result.settings || {
            darkMode: false
        };

        
        document.getElementById('darkMode').checked = settings.darkMode;
        
        
        if (settings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    } catch (error) {
        console.error('Ayarlar yüklenirken hata:', error);
    }
}


async function saveSettings() {
    try {
        await chrome.storage.local.set({ settings });
    } catch (error) {
        console.error('Ayarlar kaydedilirken hata:', error);
    }
}


function initializeSettingsEventListeners() {
    document.getElementById('darkMode').addEventListener('change', (e) => {
        settings.darkMode = e.target.checked;
        toggleDarkMode();
        saveSettings();
    });

    document.getElementById('closeSettings').addEventListener('click', () => toggleSettings());
}


function toggleSettings() {
    const settingsPanel = document.getElementById('settingsPanel');
    settingsPanel.classList.toggle('active');
}


function toggleDarkMode() {
    const darkMode = document.getElementById('darkMode').checked;
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
}


function initializeEventListeners() {
    document.getElementById('newCategoryBtn').addEventListener('click', createNewCategory);
    document.getElementById('getCurrentTabs').addEventListener('click', importCurrentTabs);
    document.getElementById('exportData').addEventListener('click', exportData);
    document.getElementById('importData').addEventListener('click', importData);
    document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
    document.getElementById('sortTabs').addEventListener('click', sortTabs);
    document.getElementById('cleanupTabs').addEventListener('click', cleanupTabs);
}


async function importCurrentTabs() {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const activeTab = tabs.find(tab => tab.active);
        const categoryName = prompt('Sekmeleri eklemek istediğiniz kategori adını girin:');
        if (categoryName) {
            if (!categories[categoryName]) {
                categories[categoryName] = [];
            }
            tabs.forEach(tab => {
                categories[categoryName].push({
                    id: tab.id,
                    title: tab.title,
                    url: tab.url,
                    favIconUrl: tab.favIconUrl
                });
            });
            await saveCategories();
            await displayCategories();
            updateStats();
        }
    } catch (error) {
        console.error('Sekmeler içe aktarılırken hata:', error);
    }
}


function exportData() {
    try {
        const dataStr = JSON.stringify(categories, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'tab_manager_backup.json';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    } catch (error) {
        console.error('Veri dışa aktarılırken hata:', error);
    }
}


function importData() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    categories = importedData;
                    await saveCategories();
                    await displayCategories();
                    updateStats();
                } catch (err) {
                    console.error('Veri içe aktarılırken hata:', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    } catch (error) {
        console.error('Veri içe aktarılırken hata:', error);
    }
}