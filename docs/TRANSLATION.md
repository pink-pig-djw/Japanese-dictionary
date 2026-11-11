# 中文释义翻译手册

词典的日语词条来自 JMdict，原始释义是英文。这份手册说明怎样把英文释义分批译成中文。
任何模型或人都可以照着做，不需要联网，也不需要原始数据库。

## 一轮的流程

```bash
python3 tools/zh.py next --n 100 --out /tmp/batch.json
```

1. 读 `/tmp/batch.json`（100 个还没翻译的词，从最常用的开始）。
2. 把译文写成一个 JSON 对象，存到 `/tmp/done.json`（格式见下）。
3. 合并并校验：

```bash
python3 tools/zh.py merge /tmp/done.json
```

4. 如果输出里有 `REJECTED`，只改被拒绝的那几条，再 `merge` 一次（已通过的不用重交）。
5. 重复。每完成 5-10 批提交一次：

```bash
git add data/zh && git commit -m "Translate ranks A-B to Chinese" && git push -u origin <分支名>
```

查看进度：

```bash
python3 tools/zh.py status
```

## 输入和输出格式

`next` 给出的一批：

```json
[{"id": 1358280, "rank": 5997, "word": "食べる", "reading": "たべる",
  "senses": [{"pos": "一段动词, 他动词", "en": "to eat"},
             {"pos": "一段动词, 他动词", "en": "to live on (e.g. a salary); to live off; to subsist on"}]}]
```

要交回的译文：**词的 id → 每个义项一条中文，顺序和数量与 `senses` 完全一致。**

```json
{"1358280": ["吃", "靠…生活；以…为生"]}
```

`merge` 会拒绝：id 不存在、义项数量对不上、空字符串、没有汉字、含假名（「」里的除外）、超过 120 字、含换行。

## 翻译规范

**总原则：译的是这个日语词在这个义项下的意思，英文只是线索。** 看着 `word`、`reading`、`pos` 一起判断。

1. **用简体中文，写成词典释义的样子**：短、准、不加句号。
   - `to eat` → `吃`，不要写成 `吃东西的动作`。
2. **同一义项里的近义说法用全角分号「；」隔开**，最多保留 3-4 个，重复的合并。
   - `railway station; train station` → `火车站；车站`
3. **不要照抄日语汉字。** 日中同形词经常意思不同，必须按英文释义来：
   - 手紙（`letter`）→ `信；书信`，不是「手纸」
   - 勉強（`study`）→ `学习`，不是「勉强」
   - 大丈夫（`safe; all right`）→ `没问题；不要紧`，不是「大丈夫」
   - 娘（`daughter`）→ `女儿`
4. **词性要对上**：动词译成动词（`to run` → `跑`），形容词译成形容词（`beautiful` → `美丽的；漂亮的`），
   副词可以带「地」，量词写明「（量词）用于数…」。
5. **括号里的说明也要译**，保留括号，用全角：
   - `yen (Japanese monetary unit)` → `日元（日本货币单位）`
   - `counter for railway stations` → `（量词）用于数车站`
6. **占位用「…」**：`to live on (e.g. a salary)` → `靠…生活（如工资）`。
7. **专有名词、动植物、术语用通行的中文译名**；没有通行译名的，意译并在括号里保留原文：
   - `shamisen` → `三味线`
   - `US-Japan Security Treaty` → `日美安全保障条约`
8. **语气和语体通过措辞体现**，不用写「（口语）」之类的标签（界面上另有标签显示）。
   粗俗、敏感词照实翻译，不要回避或美化。
9. **拿不准就直译英文**，不要编造。宁可平淡，不要出错。
10. **只写中文**：不要出现假名、罗马字读音，也不要把英文原样留着（专有名词缩写如 `CD`、`DNA` 可以保留，但要带上中文，如 `CD；光盘`）。

### 例子

| 词 | 读音 | 英文义项 | 中文 |
|---|---|---|---|
| 猫 | ねこ | cat (esp. the domestic cat, Felis catus) | 猫（尤指家猫） |
| 猫 | ねこ | shamisen | 三味线 |
| 駅 | えき | counter for railway stations and bus stations | （量词）用于数火车站、公交站 |
| 円 | えん | circle | 圆；圆形 |
| 沿って | そって | along; by; parallel to | 沿着；顺着；与…平行 |
| 行く | いく | to go; to move (in a direction or towards a specific location); to head (towards); … | 去；前往；朝…去 |
| 可愛い | かわいい | cute; adorable; charming; lovely; pretty | 可爱的；讨人喜欢的 |
| お疲れ様 | おつかれさま | thank you (for your hard work); good work | 辛苦了 |

## 多个翻译者同时做

给每个翻译者分一段互不重叠的排名范围，`merge` 自带文件锁，可以同时合并：

```bash
python3 tools/zh.py next --from 0 --to 2000 --n 100 --out /tmp/a.json
```

```bash
python3 tools/zh.py next --from 2000 --to 4000 --n 100 --out /tmp/b.json
```

## 建议的进度目标

| 排名范围 | 内容 | 说明 |
|---|---|---|
| 0 - 8,000 | 最常用词 | 覆盖日常阅读的大部分，优先完成 |
| 8,000 - 22,000 | 其余常用词 | 做完基本覆盖 JLPT 范围 |
| 22,000 - 191,541 | 生僻词、术语、古语 | 量大，可以长期慢慢补 |

## 文件说明

- `data/zh/zNNN.json`：第 NNN 块词条的译文，`{id: [各义项中文]}`。由 `merge` 写入，不要手改顺序。
- `data/zh/index.json`：哪些块有译文、总数。由工具自动更新，网页据此加载。
- 提交前可以跑一遍 `python3 tools/zh.py check`，检查所有已合并的译文。
