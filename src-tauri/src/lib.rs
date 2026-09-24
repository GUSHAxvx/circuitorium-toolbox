// 工具箱桌面版（Tauri v2）
// 前端就是工具箱的静态站点（Next 静态导出），这里只负责开个窗口 + 一个"另存为"命令。
//
// 为什么要这个命令：WebView2 里 <a download> 不会真的把文件存下来（浏览器版的下载行为在
// WebView 里没有对应的下载界面/落盘），所以桌面版走系统原生的「另存为」对话框。

use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri_plugin_dialog::DialogExt;

/// 弹原生「另存为」，把前端传来的字节写进去。返回保存到的路径；用户取消返回 None。
#[tauri::command]
async fn save_work_file(
    app: tauri::AppHandle,
    default_name: String,
    data_b64: String,
) -> Result<Option<String>, String> {
    let bytes = STANDARD
        .decode(data_b64.as_bytes())
        .map_err(|e| format!("内容编码有误：{e}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        app.dialog()
            .file()
            .set_title("保存到…")
            .set_file_name(&default_name)
            .add_filter("工具箱作品文件", &["ecp"])
            .add_filter("分享页", &["html"])
            .add_filter("备份包", &["zip"])
            .save_file(move |picked| {
                let _ = tx.send(picked);
            });

        let picked = rx.recv().map_err(|e| format!("对话框异常：{e}"))?;
        match picked {
            Some(file_path) => {
                let path = file_path
                    .into_path()
                    .map_err(|e| format!("路径不可用：{e}"))?;
                std::fs::write(&path, &bytes).map_err(|e| format!("写入失败：{e}"))?;
                Ok(Some(path.to_string_lossy().to_string()))
            }
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| format!("保存失败：{e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_work_file])
        .run(tauri::generate_context!())
        .expect("工具箱启动失败");
}
