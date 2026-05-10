"use client";
import { useEffect, useState } from "react";
type Theme = "dark" | "light";
export default function ThemeToggle(){const[theme,setTheme]=useState<Theme>("dark");useEffect(()=>{const saved=(localStorage.getItem("autottc-theme") as Theme|null)||"dark";applyTheme(saved)},[]);function applyTheme(next:Theme){document.documentElement.dataset.theme=next;localStorage.setItem("autottc-theme",next);setTheme(next)}return <div className="theme-toggle"><button className={theme==="dark"?"active":""} onClick={()=>applyTheme("dark")}>Dark</button><button className={theme==="light"?"active":""} onClick={()=>applyTheme("light")}>Light</button></div>}
