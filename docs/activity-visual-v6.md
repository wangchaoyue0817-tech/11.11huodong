# 活动 UI v6

本轮依照鉴X设计 skill，并以本次明确要求优先：深靛底色、蓝紫局部透光、纤细边界，避免榜单大面积浅色与专家卡片灰闷的实色堆叠。

- 王者榜：保留两个榜、2/1/3 领奖台、名单、个人排名和规则入口。取消浅色插画底，改为深靛玻璃领奖台、薄紫光边，冠军只用少量暖金。
- 普通/高级抽奖券：新生图为淡紫珠光与香槟玻璃票券，与现有机台的圆润材质统一；共用 `rewardArt` 覆盖选券、里程碑、发券反馈、首次引导和每日提醒。原“我的奖品”里的专家线上鉴别券维持原版组件。
- 累计进度：4px 轨道，缩小节点，移除“已获得 / 下一奖励 / 待解锁”和勾选角标；未达成素材灰色，已达成显示原色。保留真实累计数、当前指针、完整历史与横向滚动，普通/高级发券规则不变。
- AI 专家卡片：标题严格为“专家一对一鉴别”，小角标“限时免费”，描述严格为“错一赔三•专家组研判•最快30分钟出结果”。仅保留“查看详情”和“去专鉴”；前者按要求不开发下游，后者继续带产品进入传图流程。进度保留完整节点但取消独立大外框，使用同卡片透明背景。主按钮与原专家首页使用相同蓝紫渐变。
- 本轮不改专家首页服务介绍、抽奖业务、排行榜计算、券有效期及历史奖品。

## 图片来源

使用内置 `image_gen`，机台 `public/assets/gacha/machine-body-v4.png` 仅作材质与配色参照。新图片均保留透明通道：

- `public/assets/gacha/reward-ordinary-v6.png`
- `public/assets/gacha/reward-advanced-v6.png`

两次生成共用以下 prompt，并分别追加下方配色段：

> Use case: stylized-concept. Asset type: a single transparent cutout 3D lottery ticket for a premium Chinese mobile UI. Reference image is MATERIAL AND COLOR FAMILY ONLY: the smooth lavender ceramic and clear lilac glass gacha machine. Generate a fresh ticket, do not depict the machine. Single rounded landscape admission ticket, gentle side notches, one tiny embossed four-point sparkle in center, a subtle perforation near the right third. Light airy fresh elegant modern product render. Very simple silhouette and large clean surface, shallow 3D thickness with slight clockwise tilt, nearly frontal so readable at 42 CSS px. Silky ceramic, translucent pearly glass beveled border, diffused studio lighting. Centered with just 8% transparent padding, object fills 84% canvas width. No words, no lettering, no digits, no scene, no frame outside object, no gems, no chains, no wings, no scattered particles, no sharp facets, no chrome, no complex engraving. Background truly transparent.

普通券追加：

> Palette: soft lavender pearl body with clear pale lilac glass edge and a restrained violet embossed sparkle. Delicate fresh purple, not saturated electric blue.

高级券追加：

> Palette: pale champagne pearl body with translucent soft apricot-gold glass edge and a restrained warm gold embossed sparkle. Restrained premium gold, not saturated yellow. Exactly the same simple form as a modern lavender ceramic ticket.

## 验证内容

文案与按钮精确匹配、合资格与活动结束状态、跨入口节点一致、历史进度定位、未达成语义、旧奖品保留、排行榜计算与切换、榜单文字对比度和触达区域均纳入回归。浏览器检查 320、390、430 宽度；实际截图与尺寸记录保留在本地 `qa/v6/`。本工程仍为本地模拟数据的 Web Demo。
