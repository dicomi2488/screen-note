已归档的打包/原生构建文件列表

本项目已移除以下目录与文件，以只保留网页版实现（index.html、src/、resources/）：

已删除的目录/文件（如存在）:
- bin/ (neutralino 可执行文件)
- release/ (打包产物 zip/iss)
- src-tauri/ (Tauri 原生层源码与配置)
- target/ (Rust/Tauri 构建输出)
- win32/ (Windows 原生 C++/CMake 构建文件)
- build_temp/ (临时构建文件)
- wpf-overlay/ (WPF 项目输出)
- scripts/ (打包/发布辅助脚本)
- neutralino.config.json
- screen-note.sln

恢复说明：
- 若需要恢复任一已删除内容，请从最近的 git 历史或备份中恢复对应目录。示例：
  git checkout HEAD~1 -- src-tauri

- 若没有历史备份，建议从发行包或构建服务器重新生成（如果你有访问权限）。

此变更仅保留网页版前端源码：
- index.html
- src/
- resources/

如需附加帮助（例如把项目改为纯前端仓库，移除特定依赖或更新 README 说明），请告知。