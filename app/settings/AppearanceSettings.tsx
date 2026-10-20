"use client";
import {usePrefs,type ThemeMode} from "@/lib/usePrefs";
import {usePersonalization} from "@/lib/usePersonalization";

const copy={
  es:{title:"Apariencia",intro:"Elegí cómo querés ver RugbyNOW. El cambio se aplica a todas las páginas.",theme:"Tema",rugby:"Verde RugbyNOW",light:"Claro",dark:"Oscuro",spacing:"Espaciado",compact:"Compacto",comfortable:"Cómodo",text:"Tamaño del texto",standard:"Normal",large:"Grande",preview:"Vista previa",home:"Tu club",away:"Rival",reset:"Restablecer apariencia",saved:"Se guarda automáticamente en este navegador."},
  en:{title:"Appearance",intro:"Choose how RugbyNOW looks. Changes apply across the site.",theme:"Theme",rugby:"RugbyNOW green",light:"Light",dark:"Dark",spacing:"Spacing",compact:"Compact",comfortable:"Comfortable",text:"Text size",standard:"Standard",large:"Large",preview:"Preview",home:"Your club",away:"Opponent",reset:"Reset appearance",saved:"Saved automatically in this browser."},
  fr:{title:"Apparence",intro:"Choisissez l’apparence de RugbyNOW. Les changements s’appliquent à toutes les pages.",theme:"Thème",rugby:"Vert RugbyNOW",light:"Clair",dark:"Sombre",spacing:"Espacement",compact:"Compact",comfortable:"Confortable",text:"Taille du texte",standard:"Normale",large:"Grande",preview:"Aperçu",home:"Votre club",away:"Adversaire",reset:"Réinitialiser l’apparence",saved:"Enregistrement automatique dans ce navigateur."},
  it:{title:"Aspetto",intro:"Scegli l’aspetto di RugbyNOW. Le modifiche si applicano a tutte le pagine.",theme:"Tema",rugby:"Verde RugbyNOW",light:"Chiaro",dark:"Scuro",spacing:"Spaziatura",compact:"Compatto",comfortable:"Comodo",text:"Dimensione del testo",standard:"Normale",large:"Grande",preview:"Anteprima",home:"Il tuo club",away:"Avversario",reset:"Ripristina aspetto",saved:"Salvataggio automatico in questo browser."},
};

export default function AppearanceSettings(){
  const {lang,theme,setThemeEverywhere}=usePrefs();
  const {prefs,update}=usePersonalization();
  const c=copy[lang];
  return <section className="rn-panel rn-appearance" id="appearance" aria-labelledby="appearance-title">
    <h2 id="appearance-title">{c.title}</h2>
    <div className="rn-appearance-body">
      <p>{c.intro}</p>
      <fieldset><legend>{c.theme}</legend><div className="rn-theme-choices">
        {(["rugby","light","dark"] as ThemeMode[]).map(value=><button type="button" key={value} aria-pressed={theme===value} onClick={()=>setThemeEverywhere(value)}>
          <span className={`rn-theme-swatch rn-swatch-${value}`} aria-hidden="true"><i/><span><b/><b/><b/></span></span>
          <span>{c[value]} {theme===value&&<b aria-hidden="true">✓</b>}</span>
        </button>)}
      </div></fieldset>
      <div className="rn-appearance-options">
        <fieldset><legend>{c.spacing}</legend><div className="rn-choice-buttons">
          {(["compact","comfortable"] as const).map(value=><button type="button" key={value} aria-pressed={prefs.density===value} onClick={()=>update({density:value})}>{c[value]}</button>)}
        </div></fieldset>
        <fieldset><legend>{c.text}</legend><div className="rn-choice-buttons">
          {(["standard","large"] as const).map(value=><button type="button" key={value} aria-pressed={prefs.textSize===value} onClick={()=>update({textSize:value})}>{c[value]}</button>)}
        </div></fieldset>
      </div>
      <div className="rn-appearance-preview" data-spacing={prefs.density} data-text={prefs.textSize}>
        <small>{c.preview}</small><div className="rn-preview-league">RUGBYNOW</div>
        <div className="rn-preview-match"><time>15:30</time><span>{c.home}</span><strong>—</strong><span>{c.away}</span><span>TV</span></div>
      </div>
      <div className="rn-appearance-footer"><small>{c.saved}</small><button type="button" onClick={()=>{setThemeEverywhere("rugby");update({density:"compact",textSize:"standard"});}}>{c.reset}</button></div>
    </div>
  </section>;
}
