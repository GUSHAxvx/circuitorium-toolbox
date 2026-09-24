// 发布版不要弹出多余的控制台黑窗
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    circuitorium_toolbox_lib::run()
}
