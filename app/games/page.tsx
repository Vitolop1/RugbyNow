import type {Metadata} from "next";
import GamesClient from "./GamesClient";
import {utcQuizDay} from "@/lib/rugbyQuiz";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Desafío de rugby | RugbyNOW",description:"Cinco preguntas de rugby cada día, reglas e historia con fuentes oficiales. Jugá, aprendé y seguí tu progreso en RugbyNOW.",alternates:{canonical:"/games"}};
export default function GamesPage(){return <GamesClient initialDay={utcQuizDay()}/>;}
