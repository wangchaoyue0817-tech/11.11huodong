# 排行榜视觉素材与实现

- 生成方式：内置 image_gen；透明背景新图。
- 项目素材：`public/assets/gacha/leaderboard-podium-v3.png`，1536 × 1024，RGBA，3:2。
- 原图：`/Users/lunewang/.codex/generated_images/01a158b5-e2f4-7553-bf03-dda672c7d981/exec-552e0e55-8fd4-4ff5-bc55-dc395186be9a.png`。
- 设计：暖金冠军、浅紫亚军、青蓝季军；圆润简洁的玻璃与陶瓷领奖台、简单皇冠，移除早期草案的宝石和羽翼。明亮蓝紫环境与浅紫名单，适配既有活动色系。
- 图片只承载装饰。昵称、名次、单数、双榜状态、奖励与本人排名全部用 HTML/CSS 动态渲染；姓名脱敏与 HTML 转义在展示层统一完成。
- 顶部删除长口号和日期段落，只保留标题、切换与一行奖励。规则入口固定于标题栏；日期、结算和详细权益保留在规则弹层。
- 前三名保持 2—1—3 空间顺序；无人占位显示虚位以待。列表最多到第 100 名，固定本人栏仍显示超过第 100 名的本人排名。

## 完整生成提示词

```text
Use case: stylized-concept. Asset: decorative 3D leaderboard podium background for a modern premium mobile app, code overlays ALL avatars, ranks, names and numbers. Landscape 3:2 canvas, true transparent background. Three clean contemporary award stations, second on left in bright soft amethyst-purple, first taller in middle in luminous champagne-yellow, third on right in clear icy electric-blue. Smooth rounded glass-acrylic and satin ceramic-plastic. Each station has a simple round EMPTY avatar frame at upper portion and a small SIMPLE three-point crown floating immediately above it, NO wings. Under each frame is one broad smooth rounded rectangular podium panel with generously EMPTY flat front face for three lines of code text. Left station centered x18.6%, round frame y39% and diameter17% of width; center station x50%, frame y31%, diameter21%; right station x81.2%, frame y39%, diameter17%. Front text panels blank from y54% to83%. All bottoms aligned at92%, left/right slightly shorter, middle visually more prominent. Minimal contemporary friendly 3D product design, soft rounded corners, restrained glossy reflections and pearl highlights, beautiful material and gentle shadows, a thin luminous rim. Lavender left front panel, creamy warm yellow center front panel, pale ice-blue right front panel, all light enough for dark text. Tight composition 3% side margins. No texture noise. No text, no numbers, no people, no logos, no letters. ABSOLUTELY NO baroque / antique / fantasy RPG aesthetic, NO gems, NO ornate gold metal, NO feather wings, NO jeweled crowns, NO filigree, NO chrome. The sophistication comes from simple curves, refined translucency and perfect lighting. Transparent outside objects; do not render a full background scene.
```

