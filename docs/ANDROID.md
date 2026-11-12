# 安卓 App 打包说明

安卓 App 用 [Capacitor](https://capacitorjs.com/) 把网站原样装进一个安卓壳里：
网页代码只有一份，改完网页重新打包即可。词库直接打包在 APK 里，查词不需要联网。

## 和网页版的区别

| 功能 | 网页版 | App |
|---|---|---|
| 词库 | 首次打开下载，存进浏览器缓存 | 内置在安装包里 |
| 朗读 | 浏览器自带语音 | 手机系统的「文字转语音」（需要装日语语音） |
| 生词本导出 | 下载 `.tsv` 文件 | 复制到剪贴板 |
| 笔顺动画 | 联网获取 | 同左，需要联网 |

代码里用 `NATIVE`（`js/app.js`）区分；worker 通过 `worker.js?app=1` 得知自己在 App 里。

## 环境

- JDK 21、Android SDK（平台 36、build-tools 36）、Node.js
- `android/local.properties` 写上 `sdk.dir=<SDK 路径>`（不提交）

## 打包

```bash
npm install
```

```bash
npm run apk
```

`npm run apk` 依次做三件事：把网站复制到 `www/`、同步进安卓项目、打正式版。
**改了网页后一定要走这条命令**；单独运行 `npx cap sync` 不会重新生成 `www/`，打出来的还是旧代码。

产物在 `android/app/build/outputs/apk/release/app-release.apk`。

## 签名密钥（重要）

正式版必须签名。签名信息放在 `android/keystore.properties`（已被 git 忽略）：

```
storeFile=/绝对路径/sakura-jisho.keystore
storePassword=…
keyAlias=sakura
keyPassword=…
```

**密钥文件和密码务必自己备份。** 以后发布更新必须用同一把密钥签名，
否则用户手机上会提示签名冲突，只能卸载旧版（生词本等本地数据会丢失）再装新版。
密钥和密码都不要提交到仓库。

没有 `keystore.properties` 时，`assembleRelease` 会生成未签名的包（无法直接安装），
此时可以用 `./gradlew assembleDebug` 打调试包测试。

## 发布新版本前

1. 在 `android/app/build.gradle` 里把 `versionCode` 加 1，`versionName` 改成新版本号。
2. `npm run apk`。
3. 用 `apksigner verify` 确认签名。

## 图标和启动画面

由吉祥物 `assets/mascot/idle.webp` 生成，换了吉祥物后重新运行：

```bash
python3 tools/android_icons.py
```
