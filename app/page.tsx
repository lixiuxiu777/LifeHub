import ClientShell from './client-shell';
import { getChatGPTUser,chatGPTSignInPath } from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){
  const user=await getChatGPTUser();
  if(!user)return <main><section className="no-cards"><h1>欢迎回到 LifeHub</h1><p>登录后访问你的私人生活空间。记录会按登录身份保存。</p><a className="button solid" href={chatGPTSignInPath('/')} target="_top">使用 ChatGPT 登录</a></section></main>;
  return <ClientShell/>;
}
