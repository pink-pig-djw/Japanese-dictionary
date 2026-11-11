# 吉祥物图片提示词

网站里的吉祥物是一个**橙发猫耳少女**。

## 当前状态

| 表情 | 用在哪里 | 状态 |
|---|---|---|
| `idle` | 首页横幅、顶栏头像（平时） | 已有（暂用开心那张） |
| `happy` | 点她、收藏成功 | **已有** |
| `think` | 搜索中、词库加载中 | 缺，暂用 `idle` 顶替 |
| `sorry` | 没找到结果、出错 | 缺，暂用 `idle` 顶替 |
| `sleep` | 生词本为空 | 缺，暂用 `idle` 顶替 |

## 已有主图时：用它当参考图改表情（推荐）

把现有的那张图作为参考图（图生图 / 图片编辑）传进去，每次只换下面一句。这样发型、发夹、衣服都不会变。

公共部分：

```text
Use the reference image as the exact character: same girl, same orange hair and cat ears, same sakura hair clip, same sailor blouse and pink ribbon, same art style, same framing and size, transparent background. Change only her facial expression and pose as described:
```

| 文件 | 接在后面的描述 |
|---|---|
| `idle` | `a calm, gentle closed-mouth smile, relaxed eyes looking at the viewer, ears upright.` |
| `think` | `curious and thinking: eyes looking up to the upper right, one eyebrow raised, small pursed mouth, index finger on her chin, head tilted, one ear slightly folded.` |
| `sorry` | `apologetic and troubled: eyebrows slanted upward, teary shimmering eyes, small wavy frown, both hands pressed together in front of her chest, ears drooping down, one sweat drop near her temple.` |
| `sleep` | `peacefully dozing: eyes gently closed, tiny relaxed smile, head tilted onto one shoulder, ears relaxed sideways, a small sleep bubble near her head (a simple shape, no letters).` |

## 放进网站

每张图跑一次（需要 `pip install pillow`），会自动裁出整图和头像两个版本：

```bash
python3 tools/mascot.py think.png think
```

然后把 `js/mascot.js` 顶部 `IMAGES` 里对应的表情改成 `true`。

---

下面是从零开始出图时用的完整提示词。

## 通用要求

| 项目 | 要求 |
|---|---|
| 画幅 | 正方形 1:1，建议 1024×1024，最小 512×512 |
| 背景 | **透明背景**（PNG / WebP / GIF）。模型不支持透明就用纯白底，之后抠图 |
| 构图 | 半身像（胸部以上），人物居中，头顶和猫耳完整入画，四周留 8% 左右空白 |
| 一致性 | 先出「角色设定图」，后面每张都把它作为参考图传入，保证是同一个人 |
| 文件大小 | 静态图每张 ≤ 300 KB（建议转 WebP），GIF 每个 ≤ 1.5 MB |

显示尺寸很小（首页约 124 px，空状态约 128 px），所以**表情要夸张清晰、线条干净、不要复杂背景和小字**。

## 0. 角色设定（所有提示词的公共前缀）

后面每条提示词都以这段开头，只替换最后的表情与动作：

```text
A semi-realistic anime illustration of a cheerful teenage catgirl mascot, bust shot, facing the viewer.
Bright orange shoulder-length hair with soft inner highlights and a slightly messy fringe, two fluffy orange cat ears with pale pink inner fur, large expressive amber eyes with detailed irises and catchlights, fair skin with a soft blush, a small pink sakura-shaped hair clip on her left side.
She wears a cream-white sailor-style blouse with a soft pink ribbon tie.
Painterly cel shading with clean lineart, delicate lighting, soft rim light, high detail on hair and eyes, modern Japanese light-novel cover quality.
Pastel palette: sakura pink, peach orange, cream white.
Centered composition, full head and ears in frame, generous margin, transparent background, no text, no watermark, no border.
```

中文对照：半写实动漫插画风的少女猫娘吉祥物，半身像，正面。亮橙色及肩发、略乱的刘海，橙色猫耳（内侧浅粉），琥珀色大眼睛（虹膜细节与高光），白皙皮肤带淡淡红晕，左侧别一枚樱花发夹；奶白色水手服上衣配浅粉色蝴蝶结。干净线稿加厚涂赛璐璐上色，柔和轮廓光，轻小说封面级别的精细度。配色为樱花粉、蜜桃橙、奶白。居中，头和耳朵完整入画，留白充足，透明背景，无文字、无水印、无边框。

**负面提示词**（模型支持的话加上）：

```text
text, letters, watermark, signature, logo, frame, border, background scenery, extra fingers, extra ears, human ears, deformed hands, blurry, low resolution, jpeg artifacts, cropped head, 3d render, photo, nsfw
```

## 1. 角色设定图（先出这张）

文件：不放进网站，只作为后续参考图。

```text
[公共前缀]
Character reference sheet: the same girl shown three times side by side - front view, three-quarter view, and side view - neutral gentle smile, consistent design across all three, plain white background.
```

## 2. 五个表情（网站实际使用）

| 文件名 | 用在哪里 | 表情关键词 |
|---|---|---|
| `idle.png` | 首页问候 | 微笑、挥手 |
| `happy.png` | 收藏成功等好消息 | 开心大笑、闭眼 |
| `think.png` | 搜索中、词库加载中 | 思考、歪头 |
| `sorry.png` | 没找到结果、出错 | 抱歉、泪眼 |
| `sleep.png` | 生词本为空 | 打瞌睡 |

### idle.png

```text
[公共前缀]
Expression and pose: a warm, friendly closed-mouth smile, head tilted slightly, one hand raised in a small wave beside her face, ears perked up, looking directly at the viewer.
```

### happy.png

```text
[公共前缀]
Expression and pose: overjoyed, eyes closed in happy upward arcs, big open-mouth smile showing a tiny fang, both hands clasped together near her chest, ears perked, a few small sparkles around her head.
```

### think.png

```text
[公共前缀]
Expression and pose: curious and thinking, eyes looking up to the upper right, one eyebrow slightly raised, small pursed mouth, index finger resting on her chin, head tilted, one ear slightly folded.
```

### sorry.png

```text
[公共前缀]
Expression and pose: apologetic and a little troubled, eyebrows slanted upward, teary shimmering eyes, small wavy frown, both hands pressed together in front of her face in an apologetic gesture, ears drooping down, a single sweat drop near her temple.
```

### sleep.png

```text
[公共前缀]
Expression and pose: peacefully dozing off, eyes gently closed, relaxed tiny smile, cheek resting on her folded hands, ears relaxed and tilted sideways, a small soft "z z" doodle floating above her head drawn as simple shapes (not letters).
```

## 3. 动图（可选，用 sprite-gen 做）

动图优先级：`idle` > `think` > `happy`。其余两个表情用静态图就够了。

要求：循环播放、首尾帧衔接、透明背景、12 fps 左右、8-12 帧、512×512。

### idle.gif（待机循环）

```text
[公共前缀]
Sprite sheet for a looping idle animation, 8 frames in a single row, identical framing and character position in every frame.
Motion: gentle breathing (shoulders rise and fall by a few pixels), one slow blink in frames 4-5, the right cat ear twitches once in frame 6, hair sways very slightly. First and last frame match for a seamless loop.
```

### think.gif（思考循环）

```text
[公共前缀]
Sprite sheet for a looping thinking animation, 8 frames in a single row, identical framing in every frame.
Motion: finger taps her chin twice, eyes glance from upper right to upper left and back, one ear flicks, a small question-mark-shaped sparkle fades in and out above her head. Seamless loop.
```

### happy.gif（开心，播放一次即可）

```text
[公共前缀]
Sprite sheet for a short celebration animation, 10 frames in a single row, identical framing in every frame.
Motion: she bounces up slightly, eyes close into happy arcs, both hands come together in a clap, ears perk up, small sparkles burst outward and fade. Ends on a stable smiling pose.
```

## 4. 其他可选图片

这些不是必须的，网站目前用代码画的图形代替。

### 应用图标 `assets/icon.png`（512×512，用于浏览器标签页和添加到主屏幕）

```text
A cute app icon: the face of an orange-haired anime catgirl with fluffy cat ears and amber eyes, winking, a small pink sakura hair clip, simple bold shapes that read clearly at small size, on a rounded-square background with a soft gradient from sakura pink to peach orange, subtle sparkles, flat clean anime style, no text.
```

### 首页横幅背景（可选，1600×800，不含人物）

```text
A soft dreamy anime background for a mobile app banner, no characters: pastel sky gradient from sakura pink to peach orange, fluffy stylized clouds, falling cherry blossom petals, subtle halftone dot texture on the right side, gentle sparkles, lots of empty space on the left for text, clean flat anime style, no text.
```

### 分享预览图 `assets/og.png`（1200×630，链接分享时显示）

```text
[公共前缀，去掉 "transparent background"]
Wide banner composition 1200x630: the girl on the right third, smiling and holding an open book, pastel pink-to-peach gradient background with cherry blossom petals and sparkles, large empty area on the left for a title, no text.
```
