//Este archivo contiene funciones para crear codigos
import { customAlphabet } from 'nanoid';

const alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; //Especifica caracteres que ocupara nanoid para generacion de codigos
const sufijoPaquete = customAlphabet(alfabeto, 8);
const sufijoViaje = customAlphabet(alfabeto, 6); 

export const generarCodigoPaquete = () => `SBX-${sufijoPaquete()}`;

// "El Salvador" -> ES, "Estados Unidos" -> EU, "Houston" -> HOU.
// Quita tildes, una palabra = sus 3 primeras letras, varias = sus iniciales.
const abreviar = (lugar: string) => {
  const palabras = lugar
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  if (palabras.length <= 1) return (palabras[0] ?? 'XXX').slice(0, 3);
  return palabras.map((p) => p.charAt(0)).join('').slice(0, 3);
};

export const generarCodigoViaje = (origen: string, destino: string) =>
  `${abreviar(origen)}-${abreviar(destino)}-${sufijoViaje()}`; // ej: ES-EU-K7M2PQ