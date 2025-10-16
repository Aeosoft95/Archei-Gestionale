
export type ChatMsg = { t:'chat:msg', room:string, nick:string, text:string, ts:number, channel?:string };
export type Join = { t:'join', room:string, nick:string, role:'gm'|'player' };
export type Presence = { t:'chat:presence', room:string, nicks:string[] };
export type DisplayClock = { id:string, name:string, segments:number, fill:number, visible:boolean, color?:string, emoji?:string, note?:string };
export type DisplayState = { t:'DISPLAY_CLOCKS_STATE', room:string, clocks: DisplayClock[] };
export type SceneState = { t:'DISPLAY_SCENE_STATE', room:string, scene:{ title?:string, color?:string, image?:string, visible?:boolean } };
export type Banner = { t:'DISPLAY_BANNER', room:string, text:string };
export type Countdown = { t:'DISPLAY_COUNTDOWN', room:string, countdown:{ running:boolean, totalMs:number, remainMs:number, label?:string } };
