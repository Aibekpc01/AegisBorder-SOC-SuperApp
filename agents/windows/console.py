# Назначение файла: Предоставляет локальное управление и просмотр состояния Python-агента.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Password-gated local Aegis DLP console; works without a server."""
import json
import os
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

try:
    from .local_security import authenticate
except ImportError:
    from local_security import authenticate


def main():
    directory = Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "AegisBorderEndpoint"
    root = tk.Tk()
    root.title("Aegis DLP")
    root.geometry("560x340")
    root.configure(bg="#101c30")
    root.resizable(False, False)
    tk.Label(root, text="AEGIS DLP", fg="#66e2c4", bg="#101c30", font=("Segoe UI", 28, "bold")).pack(pady=24)
    panel = tk.Frame(root, bg="#101c30")
    panel.pack(fill="both", expand=True, padx=30)
    tk.Label(panel, text="Локальная консоль · доступ по паролю", fg="white", bg="#101c30").pack(pady=8)
    password = tk.Entry(panel, show="●", font=("Segoe UI", 16))
    password.pack(pady=8)

    def login():
        try:
            config = json.loads((directory / "settings.json").read_text(encoding="utf-8"))
            authenticate(config, password.get(), directory / "login.json")
        except FileNotFoundError:
            messagebox.showerror("Aegis DLP", "Сначала выполните endpoint_agent.py init")
            return
        except (ValueError, KeyError) as error:
            password.delete(0, "end")
            messagebox.showerror("Aegis DLP", str(error))
            return
        root.unbind("<Return>")
        for child in panel.winfo_children():
            child.destroy()
        mode = "Синхронизация настроена" if config.get("endpoint") else "Автономный режим · сервер не задан"
        policy = "Сохранена резервная копия USB-политики" if (directory / "usb-backup.json").exists() else "USB-политика Aegis не применялась"
        tk.Label(panel, text=mode + "\n\n" + policy + "\n\nПилотная версия. Состояние антивируса здесь не проверяется.",
                 fg="white", bg="#101c30", wraplength=490).pack(pady=12)
        tk.Button(panel, text="Заблокировать консоль", command=root.destroy).pack(pady=12)
        # No credentials retained by the UI; inactivity closes the unlocked view.
        root.after(60000, root.destroy)

    tk.Button(panel, text="Открыть консоль", command=login).pack(pady=12)
    root.bind("<Return>", lambda _: login())
    password.focus_set()
    root.mainloop()


if __name__ == "__main__":
    main()
