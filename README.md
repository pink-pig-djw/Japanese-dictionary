# 樱花日语词典

一个动漫风格、手机优先的日语词典网页。纯静态文件，不需要服务器程序，可以直接用 GitHub Pages 托管。

- **约 19 万词条、1.3 万汉字**
- 支持用**日语原文、罗马字、英文、变形**（如 食べました）和**通配符**查词
- 词条：读音、词性、义项、用法标签、相关词、朗读、**动词/形容词活用表**
- 汉字：音读、训读、拼音、笔画、年级、笔顺动画、含该字的词
- 五十音图、生词本（含闪卡复习）、搜索记录、浅色/深色模式
- 词库下载一次后保存在浏览器里，之后可离线搜索

## 本地运行

```bash
python3 -m http.server 8765
```

然后用浏览器打开 `http://localhost:8765/`。

## 部署到 GitHub Pages

在仓库的 Settings → Pages 里，把 Source 设为 **Deploy from a branch**，选择分支和 `/ (root)` 目录即可。

## 中文释义

词库原始释义是英文。中文释义通过 `tools/zh.py` 分批翻译后逐步补全，没有中文的词显示英文。
做法见 [docs/TRANSLATION.md](docs/TRANSLATION.md)，当前进度可在网页的「设置」里看到。

## 吉祥物

吉祥物是一位橙发猫耳少女。目前只有一个表情，其余表情的出图提示词和替换方法见
[docs/MASCOT_PROMPTS.md](docs/MASCOT_PROMPTS.md)。

## 重新生成词库

```bash
pip download --no-deps --no-binary :all: jamdict-data
```

解压得到 `jamdict.db` 后：

```bash
python3 tools/build_data.py path/to/jamdict.db
```

## 数据来源与许可

- 词汇：[JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)；汉字：[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)。
  版权归[电子辞书研究与开发小组（EDRDG）](https://www.edrdg.org/)所有，按
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可使用。`data/` 目录下的文件是其衍生作品，沿用同一许可。
  当前快照为 JMdict 1.08（2020 年前后），经由 [jamdict-data](https://pypi.org/project/jamdict-data/) 取得。
- 笔顺：[KanjiVG](https://kanjivg.tagaini.net/)（CC BY-SA 3.0），查看汉字时联网获取，未打包在仓库里。
- 字体：[Zen Maru Gothic](https://github.com/googlefonts/zen-marugothic)（SIL Open Font License 1.1），见 `assets/fonts/OFL.txt`。
