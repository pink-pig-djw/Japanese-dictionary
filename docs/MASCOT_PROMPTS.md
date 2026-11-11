# 吉祥物素材制作任务书

这份文档可以**整份交给本地的 Claude**，让它调用 codex 出静态图、调用 sprite-gen 出动图，再用仓库里的
`tools/mascot.py` 装进网站。照着做完后不需要再改任何网页代码。

## 1. 要交付什么

吉祥物是一位**橙发猫耳少女**，网站里有 5 个表情。每个表情需要一张静态图，最好再有一个循环动画。

| 表情 | 出现在哪里 | 静态图 | 动画 | 优先级 |
|---|---|---|---|---|
| `idle` | 首页横幅、每页右上角头像（平时） | 需要 | 需要 | **最高** |
| `happy` | 点她的时候、收藏单词成功 | **已有** | 需要 | 高 |
| `think` | 正在搜索、词库加载中 | 需要 | 需要 | 高 |
| `sorry` | 没有找到结果、出错 | 需要 | 需要 | 中 |
| `sleep` | 生词本是空的 | 需要 | 需要 | 中 |

- 参考图（角色定稿）：仓库里的 `assets/mascot/happy.webp`，或用户手里的原图。**所有新图都必须以它为参考图。**
- 没有动画的表情，网站会自动给静态图加上呼吸和摇头效果，所以**静态图是底线，动画是加分项**。
- 每个表情只装一份：装了动画就用动画，没装动画就用静态图。

## 2. 所有图片都必须满足的硬性要求

这些要求比提示词本身更重要：网站会用固定的位置裁出头像，位置不一致头像就会裁歪。

1. **正方形**，静态图 1024×1024，动画每帧 512×512。
2. **透明背景**的 PNG。做不到透明就用纯白背景（`#FFFFFF`），安装工具会自动抠掉。不要渐变、不要场景、不要阴影。
3. **构图与参考图完全一致**：半身像、正面、头在画面正中；猫耳尖贴近上边缘，肩膀到下边缘；人物大小不变。
4. **不能出现**文字、字母、水印、边框、签名。睡觉的"zzz"要画成气泡或图形，不要画成字母。
5. **角色不能变**：橙色及肩发、橙色猫耳（内侧白粉色绒毛）、琥珀色眼睛、左侧（画面右侧）樱花发夹、奶白色水手服、粉色蝴蝶结。
6. 动画里**头的位置基本不动**（上下移动不超过画面高度的 2%），只变表情、耳朵、手和小道具。

## 3. 第一步：用 codex 出 4 张静态图

把参考图传进去做图片编辑（图生图）。每张图的提示词 = **公共部分 + 该表情的描述**。

### 公共部分

```text
Edit the reference image. Keep the exact same character and art style: the same girl with bright orange shoulder-length hair, fluffy orange cat ears with pale pink-white inner fur, large amber eyes, a pink sakura hair clip on the right side of the image, a cream-white sailor blouse with pink stripes and a pink ribbon. Keep the same semi-realistic anime illustration style, the same lighting, the same line quality.
Keep the exact same framing: square image, bust shot, facing the viewer, head centered, ear tips near the top edge, shoulders reaching the bottom edge, same character size.
Transparent background. No text, no letters, no watermark, no border, no background scenery.
Change only the facial expression and pose as follows:
```

### 各表情的描述

**`idle`** — 存为 `mascot-src/idle.png`

```text
A calm, gentle closed-mouth smile. Eyes open and relaxed, looking straight at the viewer. Ears upright. Arms down, hands not visible. This is her neutral resting look.
```

**`think`** — 存为 `mascot-src/think.png`

```text
Curious and thinking. Eyes looking up toward the upper right, one eyebrow slightly raised, small pursed mouth. Her index finger rests on her chin. Keep her head upright and in the same position (do not tilt the head). Her left ear is slightly folded at the tip.
```

**`sorry`** — 存为 `mascot-src/sorry.png`

```text
Apologetic and a little troubled. Eyebrows slanted upward in the middle, large teary shimmering eyes, a small wavy frown. Both hands pressed together in front of her chest in an apologetic gesture. Both ears drooping down and outward. One small sweat drop near her temple.
```

**`sleep`** — 存为 `mascot-src/sleep.png`

```text
Peacefully dozing off. Eyes gently closed with relaxed curved lashes, a tiny relaxed smile, slight blush. Keep her head upright and in the same position. Ears relaxed, tilted slightly outward. A small round sleep bubble near her nose, drawn as a simple translucent bubble (not letters).
```

### 负面提示词（工具支持时加上）

```text
text, letters, watermark, signature, logo, frame, border, background, scenery, shadow on ground, extra fingers, deformed hands, human ears, extra ears, different hairstyle, different outfit, different character, cropped ears, zoomed in, zoomed out, tilted head, 3d render, photo, blurry, low resolution, jpeg artifacts, nsfw
```

### 每张图出完后自查

- 和参考图叠在一起看，头、耳朵、肩膀的位置基本重合。
- 发夹、衣服、发色没变。
- 四个角是透明的（或纯白）。

不合格就重出，不要勉强用。

## 4. 第二步：用 sprite-gen 出 5 个循环动画

每个动画是一张**横向单排的精灵图**（sprite sheet）：透明背景 PNG，每帧 512×512，从左到右排列。
以该表情的静态图作为第 1 帧的参考（`happy` 用现有的参考图）。

每个动画的提示词 = **动画公共部分 + 逐帧说明**。帧数少、靠"每帧停留时长"做出节奏，所以**每一帧画什么要严格照表**。

### 动画公共部分

```text
Create a sprite sheet for a looping character animation. One single horizontal row, each frame exactly 512x512 pixels, transparent background, no gaps or borders between frames, no frame numbers, no text.
Use the reference image as frame 1 and keep the exact same character, art style, framing, size and position in every frame: bust shot, facing the viewer, head centered. The head must stay in the same place in every frame; only the parts described below change. Hair, outfit, hair clip and colors stay identical across frames.
The last frame must lead smoothly back into frame 1.
```

### `idle`：待机（8 帧，循环约 3.4 秒）

存为 `mascot-src/idle-sheet.png`

```text
8 frames:
1. Resting pose exactly as the reference: eyes open, gentle closed-mouth smile, ears upright.
2. Same pose, eyelids half closed (start of a blink).
3. Same pose, eyes fully closed, lashes forming gentle downward curves.
4. Same pose, eyelids half open (end of the blink).
5. Identical to frame 1.
6. Same as frame 1 but her left ear (on the right side of the image) flicks outward by a small angle.
7. Same as frame 1 but that ear flicks slightly inward past its resting position.
8. Identical to frame 1, with the smile just a touch warmer.
```

每帧时长（毫秒）：`1400,50,90,60,1000,80,80,600`

### `happy`：开心（6 帧，循环约 0.9 秒）

存为 `mascot-src/happy-sheet.png`

```text
6 frames:
1. Exactly as the reference: big open-mouth smile showing a small fang, eyes open and sparkling.
2. Eyes closing into happy upward arcs, smile wider, ears perk up a little higher.
3. Eyes fully closed in happy arcs, shoulders raised slightly as if bouncing up, two small four-point sparkles appear near her head.
4. Same as frame 3, sparkles a bit larger and further from her head.
5. Shoulders back down, eyes still in happy arcs, sparkles fading and small.
6. Eyes opening again, big smile, no sparkles.
```

每帧时长（毫秒）：`220,90,140,140,120,160`

### `think`：思考（6 帧，循环约 2.9 秒）

存为 `mascot-src/think-sheet.png`

```text
6 frames:
1. Exactly as the think reference: eyes looking to the upper right, finger on chin, small pursed mouth.
2. Same pose, eyes moving toward the upper left, passing through the middle.
3. Same pose, eyes looking to the upper left, the other eyebrow slightly raised.
4. Same as frame 3 but one ear flicks outward.
5. Same pose, eyes moving back toward the upper right; her finger lifts slightly off her chin.
6. Same as frame 1 but with the eyes closed for a blink, finger back on her chin.
```

每帧时长（毫秒）：`1000,90,900,100,120,110`

### `sorry`：抱歉（6 帧，循环约 2.6 秒）

存为 `mascot-src/sorry-sheet.png`

```text
6 frames:
1. Exactly as the sorry reference: teary eyes, worried eyebrows, hands pressed together, ears drooping.
2. Same pose, ears droop a little lower, shoulders dip slightly.
3. Eyes squeezed shut tightly, mouth a small wavy line, hands pressed together more firmly, ears at their lowest.
4. Same as frame 3, a tiny tear glints at the corner of one eye.
5. Eyes opening halfway, still teary, shoulders rising back.
6. Same as frame 1, eyes fully open and shimmering.
```

每帧时长（毫秒）：`900,160,600,300,160,500`

### `sleep`：打瞌睡（6 帧，循环约 3.6 秒）

存为 `mascot-src/sleep-sheet.png`

```text
6 frames:
1. Exactly as the sleep reference: eyes closed, tiny smile, a small sleep bubble near her nose.
2. Breathing in: shoulders rise very slightly, the sleep bubble a little larger.
3. Shoulders at their highest, the sleep bubble larger still.
4. The sleep bubble at its largest, wobbling slightly to one side.
5. Breathing out: shoulders lower, the sleep bubble shrinking.
6. Shoulders at rest, the sleep bubble back to its smallest size, one ear gives a tiny twitch.
```

每帧时长（毫秒）：`700,600,600,500,600,600`

### 每个动画出完后自查

- 把各帧叠起来看，**头和肩膀的轮廓基本重合**，没有忽大忽小、忽左忽右。
- 帧与帧之间没有多余的缝隙或描边，整张图宽度正好是 `512 × 帧数`。
- 最后一帧接回第一帧不跳。

某个动画怎么都做不稳定，就**放弃这个动画，只装静态图**，网站会自动补上呼吸和摇头。

### 如果 sprite-gen 只能输出 GIF

GIF 的透明只有"全透明/不透明"两档，边缘会有锯齿和白边。优先级是：
**精灵图 PNG > APNG / 动态 WebP > GIF**。只能出 GIF 时，导出时不要勾选抖动（dither），并尽量用透明背景。

## 5. 第三步：装进网站

需要先 `pip install pillow`。在仓库根目录执行，每条命令装一个表情。

静态图（4 条）：

```bash
python3 tools/mascot.py mascot-src/idle.png idle
```

```bash
python3 tools/mascot.py mascot-src/think.png think
```

```bash
python3 tools/mascot.py mascot-src/sorry.png sorry
```

```bash
python3 tools/mascot.py mascot-src/sleep.png sleep
```

动画（5 条，会覆盖同名的静态图）：

```bash
python3 tools/mascot.py mascot-src/idle-sheet.png idle --frames 8 --durations 1400,50,90,60,1000,80,80,600
```

```bash
python3 tools/mascot.py mascot-src/happy-sheet.png happy --frames 6 --durations 220,90,140,140,120,160
```

```bash
python3 tools/mascot.py mascot-src/think-sheet.png think --frames 6 --durations 1000,90,900,100,120,110
```

```bash
python3 tools/mascot.py mascot-src/sorry-sheet.png sorry --frames 6 --durations 900,160,600,300,160,500
```

```bash
python3 tools/mascot.py mascot-src/sleep-sheet.png sleep --frames 6 --durations 700,600,600,500,600,600
```

如果拿到的是 GIF / APNG，不用写 `--frames`：

```bash
python3 tools/mascot.py mascot-src/idle.gif idle
```

工具会做这些事：裁成正方形、抠白底、缩放，输出整图 `assets/mascot/<表情>.webp` 和头像 `<表情>-face.webp`，
并自动把 `js/mascot.js` 里对应的表情标成 `'still'`（静态）或 `'animated'`（动画）。

## 6. 验收

```bash
python3 -m http.server 8765
```

用浏览器打开 `http://localhost:8765/`，按手机尺寸逐项看：

| 看哪里 | 应该看到 |
|---|---|
| 首页横幅 | `idle`，在动 |
| 每页右上角的头像 | `idle`；点一下变 `happy`，约 2 秒后淡回 `idle` |
| 搜索 `zzzqq` | 页面中间是 `sorry` |
| 生词本（没收藏时） | 页面中间是 `sleep` |
| 右上角头像 | 头部完整、居中，耳朵没有被裁掉 |
| 深色模式（设置里切换） | 人物边缘没有白边 |

头像裁歪说明那张图的构图和参考图不一致，需要重出那一张。

全部通过后提交：

```bash
git add assets/mascot js/mascot.js && git commit -m "Add mascot expressions and animations"
```

`mascot-src/` 里的原始大图不要提交（体积大），自己留存即可。

## 7. 可选素材（网站目前用代码画的图形代替）

**应用图标** `assets/icon.png`，512×512：

```text
A cute app icon: the face of the same orange-haired anime catgirl from the reference image, winking, pink sakura hair clip, simple bold shapes that read clearly at small size, on a rounded-square background with a soft gradient from sakura pink to peach orange, subtle sparkles, clean anime style, no text.
```

**分享预览图** `assets/og.png`，1200×630：

```text
Wide banner 1200x630: the same catgirl from the reference image on the right third, smiling and holding an open book, pastel pink-to-peach gradient background with cherry blossom petals and sparkles, large empty area on the left for a title, no text.
```

这两张做好后发给维护者接入，`tools/mascot.py` 不处理它们。
