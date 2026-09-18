export type Song={id:string;title:string;artist:string;album:string;cover:string;duration:number;genre?:string};
export type Room={code:string;name:string;limit:number;createdAt:number;participants:Record<string,{name:string;songs:Song[]}>};
const g=globalThis as typeof globalThis & {__mixmade?:Map<string,Room>};
export const rooms=g.__mixmade ?? (g.__mixmade=new Map());
export function createRoom(name:string){const code=Math.random().toString(36).slice(2,8).toUpperCase();const room:Room={code,name,limit:10,createdAt:Date.now(),participants:{}};rooms.set(code,room);return room}
