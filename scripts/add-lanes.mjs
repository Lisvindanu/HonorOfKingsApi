import fs from 'fs/promises';
import path from 'path';

// Data from hok-draft.web.id (normalized: Class Lane -> Clash Lane, Roamer -> Roaming)
const HOK_DRAFT_LANES = {
  'Haya': ['Mid Lane'],
  'Chicha': ['Clash Lane', 'Jungling', 'Farm Lane'],
  'Augran': ['Jungling', 'Clash Lane'],
  "Ao'yin": ['Farm Lane'],
  'Dyadia': ['Roaming'],
  'Milady': ['Mid Lane', 'Roaming'],
  'Angela': ['Mid Lane'],
  'Hou Yi': ['Farm Lane'],
  'Lapulapu': ['Roaming'],
  'Yixing': ['Mid Lane'],
  'Fatih': ['Clash Lane', 'Jungling'],
  'Daji': ['Mid Lane', 'Roaming'],
  'Liang': ['Roaming', 'Mid Lane'],
  'Li Xin': ['Clash Lane'],
  'Marco Polo': ['Farm Lane'],
  'Wukong': ['Jungling'],
  'Xiao Qiao': ['Mid Lane'],
  'Wang Zhaojun': ['Mid Lane'],
  'Lady Sun': ['Farm Lane'],
  'Cai Yan': ['Roaming'],
  'Mozi': ['Roaming', 'Mid Lane'],
  'Donghuang': ['Roaming', 'Clash Lane'],
  'Yaria': ['Roaming'],
  'Consort Yu': ['Farm Lane'],
  'Luban No.7': ['Farm Lane'],
  'Erin': ['Farm Lane'],
  'Garo': ['Farm Lane'],
  'Dolia': ['Roaming'],
  'Lam': ['Jungling'],
  'Dun': ['Clash Lane', 'Jungling'],
  'Kongming': ['Jungling', 'Mid Lane'],
  'Kaizer': ['Jungling', 'Clash Lane'],
  'Lady Zhen': ['Mid Lane'],
  'Luara': ['Farm Lane'],
  'Heino': ['Mid Lane'],
  'Fang': ['Farm Lane'],
  'Lu Bu': ['Clash Lane'],
  'Arthur': ['Clash Lane'],
  'Musashi': ['Jungling'],
  'Mi Yue': ['Clash Lane'],
  'Arke': ['Jungling'],
  'Kui': ['Roaming'],
  'Dian Wei': ['Jungling'],
  'Da Qiao': ['Roaming', 'Mid Lane'],
  'Gao Changgong': ['Jungling'],
  'Gao': ['Mid Lane', 'Jungling'],
  'Zhuangzi': ['Roaming', 'Jungling'],
  'Nuwa': ['Mid Lane'],
  'Biron': ['Clash Lane'],
  'Liu Shan': ['Roaming'],
  'Arli': ['Farm Lane'],
  'Alessio': ['Farm Lane'],
  'Lian Po': ['Roaming'],
  'Gan & Mo': ['Mid Lane'],
  'Sun Ce': ['Clash Lane'],
  'Ziya': ['Mid Lane', 'Roaming'],
  'Luna': ['Jungling'],
  'Diaochan': ['Mid Lane'],
  'Shouyue': ['Farm Lane'],
  'Di Renjie': ['Farm Lane'],
  'Ying': ['Jungling'],
  'Chano': ['Farm Lane'],
  'Xiang Yu': ['Clash Lane'],
  'Shi': ['Mid Lane'],
  'Mai Shiranui': ['Mid Lane'],
  'Zhang Fei': ['Roaming'],
  'Charlotte': ['Clash Lane'],
  'Garuda': ['Mid Lane'],
  'Umbrosa': ['Clash Lane', 'Jungling'],
  'Fuzi': ['Clash Lane'],
  'Li Bai': ['Jungling'],
  'Nakoruru': ['Jungling'],
  'Han Xin': ['Jungling'],
  'Yao': ['Jungling'],
  'Wuyan': ['Clash Lane'],
  'Mayene': ['Clash Lane'],
  'Yang Jian': ['Jungling', 'Clash Lane'],
  'Guan Yu': ['Clash Lane', 'Roaming'],
  'Allain': ['Clash Lane'],
  'Sun Bin': ['Roaming'],
  'Shangguan': ['Mid Lane'],
  'Cirrus': ['Jungling'],
  'Guiguzi': ['Roaming'],
  'Jing': ['Jungling'],
  'Dharma': ['Clash Lane'],
  'Nezha': ['Jungling', 'Clash Lane'],
  'Liu Bang': ['Roaming', 'Clash Lane'],
  'Sima Yi': ['Jungling'],
  'Menki': ['Jungling', 'Clash Lane'],
  'Xuance': ['Jungling'],
  'Athena': ['Jungling'],
  'Sakeer': ['Roaming'],
  'Yuhuan': ['Mid Lane', 'Jungling'],
  'Agudo': ['Jungling', 'Farm Lane'],
  'Zhou Yu': ['Mid Lane'],
  'Ming': ['Roaming'],
  'Zilong': ['Jungling'],
  'Feyd': ['Jungling'],
  'Butterfly': ['Jungling'],
  'Liu Bei': ['Jungling'],
  'Pei': ['Jungling'],
  'Meng Ya': ['Farm Lane'],
  'Huang Zhong': ['Farm Lane'],
  'Ukyo Tachibana': ['Jungling', 'Clash Lane'],
  'Bai Qi': ['Clash Lane', 'Jungling'],
  'Mulan': ['Clash Lane'],
  'Dr Bian': ['Mid Lane'],
};

async function addLanes() {
  console.log('Reading merged-api.json...');
  
  const mergedPath = path.join(process.cwd(), 'output', 'merged-api.json');
  const mergedData = JSON.parse(await fs.readFile(mergedPath, 'utf-8'));
  
  let updated = 0;
  let notFound = [];
  
  for (const [heroName, hero] of Object.entries(mergedData.main)) {
    // Check if we have lanes data from hok-draft
    if (HOK_DRAFT_LANES[heroName]) {
      hero.lanes = HOK_DRAFT_LANES[heroName];
      updated++;
    } else {
      // Fallback to single lane from existing data
      hero.lanes = hero.lane ? [hero.lane] : [];
      notFound.push(heroName);
    }
  }
  
  // Save
  await fs.writeFile(mergedPath, JSON.stringify(mergedData, null, 2));
  
  console.log('Updated ' + updated + ' heroes with multi-lane data');
  console.log('Heroes not in hok-draft (' + notFound.length + '):', notFound.slice(0, 10).join(', ') + (notFound.length > 10 ? '...' : ''));
  
  // Sample
  const chicha = mergedData.main['Chicha'];
  if (chicha) {
    console.log('\nSample - Chicha:');
    console.log('  lane:', chicha.lane);
    console.log('  lanes:', chicha.lanes);
  }
}

addLanes().catch(console.error);
