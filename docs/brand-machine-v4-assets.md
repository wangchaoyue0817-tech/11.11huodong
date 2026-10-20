# 品牌统一机身素材

- 文件：`public/assets/gacha/machine-body-v4.png`，1402 × 1122 RGBA。
- 方式：内置 image_gen 编辑；保留 v3 机身形体与透明背景，替换色彩和材质。
- 编辑目标：`machine-body-v3.png`。风格输入仅采用用户专家页截图中的深靛、蓝紫光感。
- 原始输出：`/Users/lunewang/.codex/generated_images/01a158b5-e2f4-7553-bf03-dda672c7d981/exec-486bd40c-a374-4f48-b28c-5c12c8ff1224.png`。
- 动态奖品球、旋钮裁片与出球仍由代码控制；首页隐藏缩小后难读的机台顶牌文字，弹层保留奖池说明。
- 新生成效果仍待用户检视，不视为已获认可的品牌样板。

## 提示词

```text
EDIT the first supplied transparent gashapon machine asset. The second image is ONLY a brand palette and lighting reference (deep indigo expert-service interface), do not recreate its UI. Preserve EXACT camera, canvas ratio, outer silhouette, location/size of glass chamber, display slot, dispensing hatch and circular knob from image 1 so existing code can overlay moving balls at the same coordinates. Change MATERIALS AND COLORS ONLY to match the reference platform: lustrous pale lavender satin ceramic housing (cool lavender #b5a6dc, shaded amethyst), smoked crystal lavender transparent glass, refined violet #7b55ea thin trim, pale lilac specular light and tiny soft champagne highlights. Interior chamber EMPTY with calm violet depth; still transparent enough for code-rendered prize capsules. Replace ALL cyan, aqua, bright-blue and royal-blue surfaces, trim, handle, hatch, feet with violet/amethyst. Display slot should be dark translucent plum with a thin lavender rim. Base not stark white, not charcoal-black. Knob lavender satin with a violet diagonal grip. Product finish should feel like high-end contemporary electronics photographed in a dark violet studio, subdued rich color, clear shape and crisp details, NOT glitter, toys for children, chrome ornament, jewels, arcade neon or overblown highlights. No text, logos, balls, characters, crowns, decorations, floor or backdrop. Keep transparent background and exact empty spaces. Leave the original shape, camera and geometry strictly unchanged.
```
