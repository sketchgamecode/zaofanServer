/** 
 * 副本 Boss 数值配置表 (v1.0)
 * 核心设计：暗黑武侠文化解构。数值强指数级膨胀设计，验证中后期的系统养成深度。
 */

export interface DungeonBoss {
  id: string;
  name: string;
  description: string; // 梗/典故描述
  level: number;
  class: 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D'; // A:猛将 B:游侠 C:谋士 D:刺客
  attributes: {
    strength: number;     // 力量
    dexterity: number;    // 身法
    intelligence: number; // 智谋
    constitution: number; // 体质 (决定海量 HP 面板)
    luck: number;         // 福缘
  };
  weaponDamage: number;   // 基础武器伤害
  armor: number;          // 基础护甲值
  rewardXp: number;       // 奖励经验
  rewardCoins: number;    // 奖励铜钱
}

export interface DungeonChapter {
  id: string;
  name: string;
  unlockLevel: number;    // 章节解锁所需等级
  bosses: DungeonBoss[];  // 固定长度 10
}

export const DUNGEON_CHAPTERS: DungeonChapter[] = [
  // ============================================================================
  // Chapter 1: 【废弃的蜀山银矿】 - 解构《指环王-莫瑞亚矿坑》 (Unlock: 10)
  // 主题：被不可名状之物污染的修仙圣地矿区，全是丧尸化的矿工与变异妖物
  // ============================================================================
  {
    id: "chapter_1",
    name: "废弃的蜀山银矿",
    unlockLevel: 10,
    bosses: [
      { id: "c1_b1", name: "走火入魔的掘金客", description: "人为财死，鸟为食亡。为了二两白银，他连祖传的飞剑都当了。", level: 10, class: "CLASS_A", attributes: { strength: 45, dexterity: 20, intelligence: 10, constitution: 60, luck: 15 }, weaponDamage: 40, armor: 25, rewardXp: 1200, rewardCoins: 800 },
      { id: "c1_b2", name: "变异的监工", description: "曾因克扣矿工工钱被天道惩戒，如今连身上流的血都是水银。", level: 11, class: "CLASS_A", attributes: { strength: 55, dexterity: 25, intelligence: 12, constitution: 75, luck: 15 }, weaponDamage: 50, armor: 30, rewardXp: 1400, rewardCoins: 950 },
      { id: "c1_b3", name: "尸变的剑修残魂", description: "‘御剑乘风去，除魔天地间...’只可惜他连矿坑里的铜臭煞气都挡不住。", level: 12, class: "CLASS_B", attributes: { strength: 40, dexterity: 70, intelligence: 20, constitution: 65, luck: 30 }, weaponDamage: 65, armor: 20, rewardXp: 1650, rewardCoins: 1100 },
      { id: "c1_b4", name: "嗜血矿匪头目", description: "此树是他栽，此矿也是他开，要想过此路，留下项上人头来。", level: 13, class: "CLASS_D", attributes: { strength: 50, dexterity: 90, intelligence: 15, constitution: 80, luck: 45 }, weaponDamage: 55, armor: 25, rewardXp: 1900, rewardCoins: 1300 },
      { id: "c1_b5", name: "毒瘴石兽", description: "原本是镇压风水的瑞兽，被贪官的铜臭气熏陶了数百年，终于变成了妖怪。", level: 14, class: "CLASS_A", attributes: { strength: 80, dexterity: 15, intelligence: 10, constitution: 120, luck: 10 }, weaponDamage: 75, armor: 60, rewardXp: 2200, rewardCoins: 1500 },
      { id: "c1_b6", name: "盲眼邪法阵师", description: "为了算出绝世银脉的位置泄露了天机，双目失明，但显然老天盲得更彻底。", level: 15, class: "CLASS_C", attributes: { strength: 20, dexterity: 30, intelligence: 110, constitution: 85, luck: 40 }, weaponDamage: 90, armor: 35, rewardXp: 2500, rewardCoins: 1750 },
      { id: "c1_b7", name: "银脉寄生虫尸", description: "这鬼东西最喜欢钻进贪官的肚皮里，可惜大宋的贪官太多，它都不够分了。", level: 16, class: "CLASS_B", attributes: { strength: 65, dexterity: 120, intelligence: 40, constitution: 100, luck: 50 }, weaponDamage: 95, armor: 40, rewardXp: 2900, rewardCoins: 2000 },
      { id: "c1_b8", name: "影杀护卫", description: "拿人钱财，替人消灾。只要白银给够数，就是天皇老子他也敢拔刀。", level: 17, class: "CLASS_D", attributes: { strength: 70, dexterity: 150, intelligence: 30, constitution: 110, luck: 60 }, weaponDamage: 110, armor: 45, rewardXp: 3350, rewardCoins: 2300 },
      { id: "c1_b9", name: "被感染的蜀山执事", description: "平日里最爱克扣外门弟子丹药，如今落得个经脉寸断，当真是天雷报应。", level: 18, class: "CLASS_C", attributes: { strength: 45, dexterity: 55, intelligence: 180, constitution: 150, luck: 75 }, weaponDamage: 135, armor: 65, rewardXp: 3900, rewardCoins: 2700 },
      { id: "c1_b10", name: "【巨魔】深渊银煞兽", description: "它曾是采石矿的异兽，直到有一天尝了人血，才发现凡人比银矿脆口多了。", level: 20, class: "CLASS_A", attributes: { strength: 220, dexterity: 60, intelligence: 30, constitution: 350, luck: 80 }, weaponDamage: 180, armor: 110, rewardXp: 5000, rewardCoins: 3500 }
    ]
  },

  // ============================================================================
  // Chapter 2: 【汴京城谍影】 - 解构《权力的游戏》 (Unlock: 20)
  // 主题：充满背叛、暗杀与权谋的吃人皇城，各方势力的死士在此角逐
  // ============================================================================
  {
    id: "chapter_2",
    name: "汴京城谍影",
    unlockLevel: 20,
    bosses: [
      { id: "c2_b1", name: "皇城司外围探子", description: "表面是个挑担子卖炊饼的，其实底下的筐里藏着一卷罗织罪名的密信。", level: 21, class: "CLASS_D", attributes: { strength: 180, dexterity: 350, intelligence: 120, constitution: 280, luck: 150 }, weaponDamage: 220, armor: 130, rewardXp: 6500, rewardCoins: 4500 },
      { id: "c2_b2", name: "腐败的东华门守将", description: "‘东华门外唱名者方为好汉？’不，交足了东华门过路费的，才是真的好汉！", level: 22, class: "CLASS_A", attributes: { strength: 380, dexterity: 180, intelligence: 100, constitution: 450, luck: 120 }, weaponDamage: 290, armor: 220, rewardXp: 7500, rewardCoins: 5200 },
      { id: "c2_b3", name: "勾栏听曲杀手", description: "‘商女不知亡国恨，隔江犹唱后庭花’，而他此时吹奏的笛中剑，偏巧是送你过那条江的。", level: 23, class: "CLASS_D", attributes: { strength: 210, dexterity: 480, intelligence: 140, constitution: 320, luck: 240 }, weaponDamage: 280, armor: 150, rewardXp: 8800, rewardCoins: 6000 },
      { id: "c2_b4", name: "相府毒士", description: "他给相爷出的那些斩草除根的主意，比皇上的御膳还要黑上三分。", level: 24, class: "CLASS_C", attributes: { strength: 150, dexterity: 220, intelligence: 550, constitution: 300, luck: 280 }, weaponDamage: 380, armor: 170, rewardXp: 10000, rewardCoins: 7100 },
      { id: "c2_b5", name: "汴河黑帮龙头", description: "十万生辰纲你都敢劫？！——巧了不是，十万生辰纲还真就是他给指的道。", level: 25, class: "CLASS_A", attributes: { strength: 580, dexterity: 260, intelligence: 180, constitution: 720, luck: 300 }, weaponDamage: 450, armor: 320, rewardXp: 11500, rewardCoins: 8200 },
      { id: "c2_b6", name: "禁军私兵营长", description: "大宋八十万禁军教头算什么？能帮高衙内去街上强抢民女的，才是实打实的油水肥差。", level: 26, class: "CLASS_A", attributes: { strength: 750, dexterity: 320, intelligence: 200, constitution: 850, luck: 320 }, weaponDamage: 540, armor: 400, rewardXp: 13500, rewardCoins: 9500 },
      { id: "c2_b7", name: "夜行飞檐侠盗", description: "‘时迁老弟，借你养的老母鸡炖个汤’——他说完，把一锅鸡汤连同锅底一起端下房梁了。", level: 27, class: "CLASS_B", attributes: { strength: 400, dexterity: 850, intelligence: 300, constitution: 550, luck: 500 }, weaponDamage: 480, armor: 280, rewardXp: 15800, rewardCoins: 11000 },
      { id: "c2_b8", name: "长生库妖蛊道人", description: "放印子钱的最高境界，就是让你死了之后，还得在阴曹地府替他当牛做马还九出十三归。", level: 28, class: "CLASS_C", attributes: { strength: 300, dexterity: 380, intelligence: 1050, constitution: 650, luck: 450 }, weaponDamage: 680, armor: 330, rewardXp: 18500, rewardCoins: 13000 },
      { id: "c2_b9", name: "西夏一品堂潜伏者", description: "在汴京潜伏了太久，甚至已经习惯了每天早上起来，去南瓦子喝一碗加了鹤顶红的豆汁。", level: 29, class: "CLASS_D", attributes: { strength: 600, dexterity: 1100, intelligence: 400, constitution: 750, luck: 650 }, weaponDamage: 720, armor: 350, rewardXp: 21500, rewardCoins: 15500 },
      { id: "c2_b10", name: "【黑手】太师心腹·血手", description: "太师让你三更死，谁敢留人到五更？连黑白无常拿他的命牌都嫌烫手。", level: 31, class: "CLASS_B", attributes: { strength: 1200, dexterity: 1500, intelligence: 600, constitution: 1800, luck: 800 }, weaponDamage: 1050, armor: 650, rewardXp: 28000, rewardCoins: 20000 }
    ]
  },

  // ============================================================================
  // Chapter 3: 【邪道修仙书院】 - 解构《哈利波特-霍格沃茨》 (Unlock: 30)
  // 主题：用活人和弟子炼丹做实验的疯狂书院，表面是书院，底下是人间炼狱
  // ============================================================================
  {
    id: "chapter_3",
    name: "邪道修仙书院",
    unlockLevel: 30,
    bosses: [
      { id: "c3_b1", name: "吞食朱砂的癫童", description: "‘先生说书中自有黄金屋！’所以他把《论语》拌着朱砂一起咽下去了。", level: 32, class: "CLASS_A", attributes: { strength: 1500, dexterity: 800, intelligence: 400, constitution: 2100, luck: 600 }, weaponDamage: 1250, armor: 850, rewardXp: 35000, rewardCoins: 25000 },
      { id: "c3_b2", name: "走火入魔的狂儒", description: "考了半辈子科举连个秀才都没中，如今逢人便问‘茴香豆的茴字有几种写法’，答错就要命。", level: 33, class: "CLASS_B", attributes: { strength: 1300, dexterity: 1900, intelligence: 800, constitution: 1800, luck: 850 }, weaponDamage: 1380, armor: 800, rewardXp: 41000, rewardCoins: 29000 },
      { id: "c3_b3", name: "缝合的魁梧尸仆", description: "书院里那些交不起束脩的学子，最后都以另一种形式永远留在了这里。", level: 34, class: "CLASS_A", attributes: { strength: 2400, dexterity: 900, intelligence: 300, constitution: 3500, luck: 400 }, weaponDamage: 1800, armor: 1200, rewardXp: 48000, rewardCoins: 33000 },
      { id: "c3_b4", name: "炼魂戒尺导师", description: "‘玉不琢，不成器’，他这一尺子下去，非得把学生的脑浆都琢出来不可。", level: 35, class: "CLASS_C", attributes: { strength: 900, dexterity: 1100, intelligence: 2900, constitution: 1900, luck: 1200 }, weaponDamage: 2200, armor: 950, rewardXp: 56000, rewardCoins: 38000 },
      { id: "c3_b5", name: "骨笛魅音魔童", description: "比起他吹跑调的《梅花三弄》，还是让他直接索命比较痛快。", level: 36, class: "CLASS_C", attributes: { strength: 1100, dexterity: 1400, intelligence: 3600, constitution: 2200, luck: 1400 }, weaponDamage: 2600, armor: 1100, rewardXp: 65000, rewardCoins: 45000 },
      { id: "c3_b6", name: "毒咒双子煞", description: "科场舞弊被抓后发配充军的倒霉蛋，如今被炼化连体重都只算一份。", level: 37, class: "CLASS_D", attributes: { strength: 1800, dexterity: 3800, intelligence: 1500, constitution: 2500, luck: 2000 }, weaponDamage: 2850, armor: 1300, rewardXp: 75000, rewardCoins: 52000 },
      { id: "c3_b7", name: "血池护法异妖", description: "据说这池子里的根本不是水，而是历届落榜书生流下的鳄鱼眼泪。", level: 38, class: "CLASS_A", attributes: { strength: 4200, dexterity: 1500, intelligence: 800, constitution: 5800, luck: 1100 }, weaponDamage: 3400, armor: 2200, rewardXp: 87000, rewardCoins: 60000 },
      { id: "c3_b8", name: "叛逆的剑道真传", description: "‘儒以文乱法，侠以武犯禁！’他觉得自己两样都占了，于是心安理得地砍了恩师。", level: 39, class: "CLASS_B", attributes: { strength: 3100, dexterity: 4800, intelligence: 2200, constitution: 4000, luck: 2500 }, weaponDamage: 3800, armor: 1900, rewardXp: 100000, rewardCoins: 69000 },
      { id: "c3_b9", name: "禁阁守门妖道", description: "这里是大宋皇家禁地！...除非你懂得怎么往门缝里偷偷塞交子。", level: 40, class: "CLASS_C", attributes: { strength: 2200, dexterity: 2800, intelligence: 6500, constitution: 4500, luck: 3500 }, weaponDamage: 4500, armor: 2100, rewardXp: 115000, rewardCoins: 80000 },
      { id: "c3_b10", name: "【院长】丹王·赤煞子", description: "‘这世上哪有什么长生不老药，无非是拿一百个童男童女熬一锅杂碎汤罢了。’", level: 42, class: "CLASS_A", attributes: { strength: 7500, dexterity: 4000, intelligence: 5500, constitution: 9500, luck: 4500 }, weaponDamage: 6200, armor: 3800, rewardXp: 140000, rewardCoins: 98000 }
    ]
  },

  // ============================================================================
  // Chapter 4: 【大漠龙门黑客栈】 - 解构《疯狂的麦克斯》与新龙门客栈 (Unlock: 40)
  // 主题：风沙、黑店、雇佣兵与人肉包子，弱肉强食的法外前哨站
  // ============================================================================
  {
    id: "chapter_4",
    name: "大漠龙门黑客栈",
    unlockLevel: 40,
    bosses: [
      { id: "c4_b1", name: "塞外剥皮客", description: "‘客官这身锦缎真是不错，剥下来做人皮唐卡必定是上品。’", level: 43, class: "CLASS_D", attributes: { strength: 5200, dexterity: 8500, intelligence: 3500, constitution: 6500, luck: 4200 }, weaponDamage: 5800, armor: 3100, rewardXp: 165000, rewardCoins: 115000 },
      { id: "c4_b2", name: "狂沙马匪头目", description: "‘此山是我开……哎等等，大漠里没山，总之留下买路财！’", level: 44, class: "CLASS_B", attributes: { strength: 6500, dexterity: 9200, intelligence: 4000, constitution: 8000, luck: 4800 }, weaponDamage: 6600, armor: 3500, rewardXp: 190000, rewardCoins: 135000 },
      { id: "c4_b3", name: "毒辣的老板娘", description: "‘大郎，尝尝这特调的绝命药酒？保你喝完浑身舒坦，下辈子早投胎。’", level: 45, class: "CLASS_C", attributes: { strength: 4500, dexterity: 6800, intelligence: 12500, constitution: 7500, luck: 6500 }, weaponDamage: 8200, armor: 3900, rewardXp: 220000, rewardCoins: 155000 },
      { id: "c4_b4", name: "骨相人肉庖丁", description: "他切肉的手法之快，连当年在十字坡卖包子的孙二娘看了都要甘拜下风。", level: 46, class: "CLASS_A", attributes: { strength: 11500, dexterity: 5500, intelligence: 2500, constitution: 14500, luck: 3500 }, weaponDamage: 9500, armor: 6000, rewardXp: 255000, rewardCoins: 180000 },
      { id: "c4_b5", name: "西域邪门沙僧", description: "他脖子上挂的不是佛珠，而是九个不肯给香油钱的吝啬鬼的头颅。", level: 47, class: "CLASS_C", attributes: { strength: 6000, dexterity: 8500, intelligence: 16800, constitution: 9500, luck: 8000 }, weaponDamage: 11000, armor: 5200, rewardXp: 295000, rewardCoins: 210000 },
      { id: "c4_b6", name: "瀚海巨型毒蝎王", description: "不知吃了多少客栈后院抛出的毒尸，如今它的尾针连罗汉也能毒翻。", level: 48, class: "CLASS_A", attributes: { strength: 16000, dexterity: 7000, intelligence: 3500, constitution: 21000, luck: 5500 }, weaponDamage: 13500, armor: 8800, rewardXp: 345000, rewardCoins: 245000 },
      { id: "c4_b7", name: "摸金盗墓散人", description: "‘寻龙分金看缠山...不对，这客栈底下睡着个连黑驴蹄子都镇不住的祖宗！’", level: 49, class: "CLASS_B", attributes: { strength: 9500, dexterity: 15500, intelligence: 8500, constitution: 13500, luck: 12000 }, weaponDamage: 12500, armor: 6500, rewardXp: 400000, rewardCoins: 285000 },
      { id: "c4_b8", name: "流沙暗影刀客", description: "一刀斩断风沙，二刀劈开口袋收金子，三刀直接把你埋在沙丘底下。", level: 50, class: "CLASS_D", attributes: { strength: 11000, dexterity: 22000, intelligence: 9000, constitution: 15000, luck: 13500 }, weaponDamage: 14800, armor: 7200, rewardXp: 460000, rewardCoins: 330000 },
      { id: "c4_b9", name: "关外铁浮屠先锋", description: "生前只知冲锋陷阵，如今大宋没亡，他却成了大漠里没主子的孤魂野鬼。", level: 51, class: "CLASS_A", attributes: { strength: 24000, dexterity: 11000, intelligence: 6000, constitution: 31000, luck: 8500 }, weaponDamage: 18500, armor: 14500, rewardXp: 535000, rewardCoins: 385000 },
      { id: "c4_b10", name: "【黑店之主】龙门千佛手", description: "‘到了我龙门客栈，哪怕你是八十万禁军教头林冲，也得乖乖当我的下酒菜。’", level: 53, class: "CLASS_B", attributes: { strength: 28000, dexterity: 35000, intelligence: 18000, constitution: 38000, luck: 21000 }, weaponDamage: 25000, armor: 15000, rewardXp: 650000, rewardCoins: 460000 }
    ]
  },

  // ============================================================================
  // Chapter 5: 【湘西赶尸古墓地牢】 - 解构《生化危机》与《古墓丽影》 (Unlock: 50)
  // 主题：充满瘴气、奇毒与古老陵墓守卫的地窟，僵尸病毒的古代起源处
  // ============================================================================
  {
    id: "chapter_5",
    name: "湘西赶尸古墓地牢",
    unlockLevel: 50,
    bosses: [
      { id: "c5_b1", name: "敲锣引路鬼", description: "‘阴人上路，阳人回避...哎，别拿糯米丢我，那玩意儿现在不仅不治病，还粘牙！’", level: 54, class: "CLASS_C", attributes: { strength: 16000, dexterity: 22000, intelligence: 36000, constitution: 28000, luck: 18000 }, weaponDamage: 22000, armor: 12000, rewardXp: 750000, rewardCoins: 520000 },
      { id: "c5_b2", name: "剧毒苗疆死巫女", description: "情蛊不是用来谈恋爱的，那是用来确保你这辈子都乖乖听话的枷锁。", level: 55, class: "CLASS_C", attributes: { strength: 14500, dexterity: 28000, intelligence: 45000, constitution: 31000, luck: 26000 }, weaponDamage: 26500, armor: 13500, rewardXp: 860000, rewardCoins: 600000 },
      { id: "c5_b3", name: "百炼铜甲行尸", description: "刀枪不入，水火不侵，唯一的弱点可能是怕遇到缺钱的响马把你熔了当铜钱花。", level: 56, class: "CLASS_A", attributes: { strength: 42000, dexterity: 18000, intelligence: 11000, constitution: 55000, luck: 14000 }, weaponDamage: 31000, armor: 25000, rewardXp: 980000, rewardCoins: 690000 },
      { id: "c5_b4", name: "嗜血飞天僵", description: "自从悟透了轻功的奥秘，他吃人的效率从陆战步兵级提升到了低空掠夺级。", level: 57, class: "CLASS_B", attributes: { strength: 36000, dexterity: 52000, intelligence: 22000, constitution: 46000, luck: 31000 }, weaponDamage: 38000, armor: 19000, rewardXp: 1120000, rewardCoins: 780000 },
      { id: "c5_b5", name: "变异湘西赶尸尊者", description: "‘各位东主托付的尸首必须按时送达，中途诈尸算不可抗力的天罚，恕不赔钱。’", level: 58, class: "CLASS_C", attributes: { strength: 25000, dexterity: 36000, intelligence: 68000, constitution: 45000, luck: 38000 }, weaponDamage: 45000, armor: 22000, rewardXp: 1280000, rewardCoins: 890000 },
      { id: "c5_b6", name: "墓道鬼影刺客", description: "‘夜半莫问路，回头鬼吹灯’——他就是那个专门埋伏在转角处吹灯的混蛋。", level: 59, class: "CLASS_D", attributes: { strength: 32000, dexterity: 68000, intelligence: 29000, constitution: 52000, luck: 45000 }, weaponDamage: 49000, armor: 24500, rewardXp: 1450000, rewardCoins: 1000000 },
      { id: "c5_b7", name: "主墓百年血尸王", description: "在青铜椁里安详地睡了百年，最恨的就是那些手里拿着洛阳铲的文盲吵他清梦。", level: 60, class: "CLASS_A", attributes: { strength: 75000, dexterity: 31000, intelligence: 20000, constitution: 98000, luck: 32000 }, weaponDamage: 58000, armor: 45000, rewardXp: 1650000, rewardCoins: 1150000 },
      { id: "c5_b8", name: "殉葬九幽毒蛛王", description: "陪葬的最高境界，就是把整个地宫变成一张挂满了人皮的罗网，静候摸金校尉。", level: 61, class: "CLASS_D", attributes: { strength: 48000, dexterity: 88000, intelligence: 41000, constitution: 72000, luck: 62000 }, weaponDamage: 65000, armor: 32000, rewardXp: 1880000, rewardCoins: 1300000 },
      { id: "c5_b9", name: "镇墓凶兽·睚眦", description: "龙生九子偏偏是个记仇的，你在墓道里瞪它一眼，它能把你祖宗十八代的棺材板都掀了。", level: 62, class: "CLASS_A", attributes: { strength: 110000, dexterity: 48000, intelligence: 28000, constitution: 145000, luck: 45000 }, weaponDamage: 82000, armor: 65000, rewardXp: 2150000, rewardCoins: 1500000 },
      { id: "c5_b10", name: "【尸祖】将臣之魄", description: "神仙难救，药石无医，传闻当年连武松的师父碰上它的秽气也得退避三舍。", level: 64, class: "CLASS_A", attributes: { strength: 165000, dexterity: 85000, intelligence: 60000, constitution: 250000, luck: 88000 }, weaponDamage: 115000, armor: 95000, rewardXp: 2800000, rewardCoins: 1950000 }
    ]
  },

  // ============================================================================
  // Chapter 6: 【唐门绝命毒瘴林】 - 解构《Shakes & Fidget - The Toxic Tree》 (Unlock: 60)
  // 主题：充满剧毒植物、变异妖兽与唐门叛徒的致命丛林，触碰任何枝叶都可能毙命
  // ============================================================================
  {
    id: "chapter_6",
    name: "唐门绝命毒瘴林",
    unlockLevel: 60,
    bosses: [
      { id: "c6_b1", name: "剧毒食人魔花", description: "它原本只是一株普通的捕蝇草，直到有一天，一个胖头陀在它旁边不小心掉了一块肉。", level: 65, class: "CLASS_A", attributes: { strength: 180000, dexterity: 45000, intelligence: 35000, constitution: 320000, luck: 55000 }, weaponDamage: 135000, armor: 75000, rewardXp: 3500000, rewardCoins: 2400000 },
      { id: "c6_b2", name: "迷幻毒蘑菇精", description: "红伞伞，白杆杆，吃完一起躺板板。不仅能躺板板，还能顺便带你游一趟阴曹地府。", level: 66, class: "CLASS_C", attributes: { strength: 65000, dexterity: 85000, intelligence: 150000, constitution: 180000, luck: 120000 }, weaponDamage: 165000, armor: 85000, rewardXp: 4100000, rewardCoins: 2800000 },
      { id: "c6_b3", name: "千足铁甲蜈蚣", description: "它有几千只脚，所以每天出门前都要纠结先迈哪只脚，最后决定先咬死路上的旅人解气。", level: 67, class: "CLASS_B", attributes: { strength: 125000, dexterity: 185000, intelligence: 50000, constitution: 250000, luck: 95000 }, weaponDamage: 210000, armor: 110000, rewardXp: 4800000, rewardCoins: 3300000 },
      { id: "c6_b4", name: "叛逃的唐门毒师", description: "‘唐老太太的传统毒方太慢了！我要做的是在你的茶碗里撒下一片五颜六色的鹤顶红！’", level: 68, class: "CLASS_D", attributes: { strength: 80000, dexterity: 220000, intelligence: 180000, constitution: 160000, luck: 150000 }, weaponDamage: 245000, armor: 95000, rewardXp: 5600000, rewardCoins: 3800000 },
      { id: "c6_b5", name: "腐化千年古树妖", description: "千年的老藤，吸够了乱葬岗里的死人怨气，如今它吐出的话都带着催命的恶咒。", level: 69, class: "CLASS_A", attributes: { strength: 280000, dexterity: 55000, intelligence: 80000, constitution: 450000, luck: 75000 }, weaponDamage: 185000, armor: 180000, rewardXp: 6600000, rewardCoins: 4500000 },
      { id: "c6_b6", name: "五毒邪教圣使", description: "‘蛤蟆、蜈蚣、毒蛇、蝎子、壁虎……大郎，今天你想先熬哪样补补身子？’", level: 70, class: "CLASS_C", attributes: { strength: 95000, dexterity: 140000, intelligence: 310000, constitution: 220000, luck: 180000 }, weaponDamage: 295000, armor: 135000, rewardXp: 7800000, rewardCoins: 5200000 },
      { id: "c6_b7", name: "剧毒沼泽巨鳄", description: "深陷沼泽不可怕，可怕的是沼泽里有一口能把你连人带着铁甲一起嚼碎的铡刀横在那。", level: 71, class: "CLASS_B", attributes: { strength: 220000, dexterity: 310000, intelligence: 70000, constitution: 380000, luck: 115000 }, weaponDamage: 320000, armor: 165000, rewardXp: 9200000, rewardCoins: 6100000 },
      { id: "c6_b8", name: "暗影毒刺蜂后", description: "‘什么暴雨梨花针？在我尾后针的密集阵型面前，唐门的暗器全都是不入流的玩具！’", level: 72, class: "CLASS_D", attributes: { strength: 140000, dexterity: 420000, intelligence: 120000, constitution: 280000, luck: 250000 }, weaponDamage: 380000, armor: 145000, rewardXp: 10800000, rewardCoins: 7200000 },
      { id: "c6_b9", name: "万毒归宗阵眼石人", description: "这块生辰石被药酒泡了几百年，连上面长的青苔都能当场毒死一头水牛。", level: 73, class: "CLASS_A", attributes: { strength: 450000, dexterity: 85000, intelligence: 150000, constitution: 750000, luck: 120000 }, weaponDamage: 280000, armor: 280000, rewardXp: 12800000, rewardCoins: 8500000 },
      { id: "c6_b10", name: "【毒魁】唐门老祖之影", description: "‘佛怒唐莲？不，老夫这叫众生平等！沾上一点，神仙也得下去陪葬！’", level: 75, class: "CLASS_B", attributes: { strength: 350000, dexterity: 650000, intelligence: 280000, constitution: 600000, luck: 450000 }, weaponDamage: 550000, armor: 250000, rewardXp: 16000000, rewardCoins: 10500000 }
    ]
  }
];
