import {ImageResponse} from 'next/og';
export const alt='RugbyNOW · Agenda, resultados y dónde ver rugby';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){
 return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#0b3527',color:'#fff',padding:70,flexDirection:'column',justifyContent:'space-between',borderBottom:'16px solid #b9ef7e'}}>
  <div style={{display:'flex',fontSize:66,fontWeight:700}}>RUGBY<span style={{color:'#b9ef7e'}}>NOW</span></div>
  <div style={{display:'flex',fontSize:64,fontWeight:700,maxWidth:1000}}>Todo el rugby. Una agenda.</div>
  <div style={{display:'flex',fontSize:30,color:'#d2e6da'}}>Partidos · Resultados · Dónde verlo</div>
  <div style={{display:'flex',fontSize:25,color:'#b9ef7e'}}>rugby-now.com</div>
 </div>,size);
}
