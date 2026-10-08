// A ROUPA DA CLASSE (dono, 08/10: "tem personagem que ficou com outfit sem ser da classe — coloque todos os personagens com a outfit da
// classe própria"). Quem nasceu antes de as roupas das classes do PoE irem para produção nasceu com a roupa padrão da vocação. Uma vez por
// personagem (a marca `roupaDaClasse`): ele veste a roupa da classe dele, pelo sexo — a mesma de quem nasce agora (`Classes.outfitInicial`,
// a da criação) —, e ela fica dele (`outfitsDaClasse`). Depois disso, se ele trocar de roupa, a escolha dele fica.
//
// Quem aplica: o servidor, no BOOT (`aplicarEmTodos`, antes de abrir as conexões — ninguém online regrava a roupa velha por cima) e, por
// garantia, ao entrar no personagem (`aplicar`). Classe sem roupa definida (o Templário hoje): só ganha a marca e fica com a dele.
import * as Classes from '../classes.mjs';
import { sqlDoPoe } from './legado.mjs';

export const MARCA = 'roupaDaClasse';

/** Veste a roupa da classe, uma vez. Devolve `'vestiu'`, `'marcou'` (classe sem roupa) ou `null` (já tinha a marca). Muta o estado. */
export function aplicar(estado, sexo = null) {
  if (!estado || estado[MARCA]) return null;
  estado[MARCA] = 1;
  const roupa = Classes.outfitInicial(Classes.obter(estado.classe), estado.sex ?? sexo ?? 'male');
  if (!roupa) return 'marcou';
  // A montaria não é da roupa: fica a que ele tinha.
  estado.outfit = { ...roupa, mount: estado.outfit?.mount ?? 0 };
  estado.outfitsDaClasse = { ...(estado.outfitsDaClasse ?? {}), [roupa.type]: roupa.addons };
  return 'vestiu';
}

/** Todos os personagens do PoE no banco (o boot): `{ vestidos, marcados }`. */
export async function aplicarEmTodos(B) {
  const linhas = await B.banco.prepare(`SELECT id, sexo, estado FROM personagens WHERE ${sqlDoPoe(B.banco.dialeto)}`).all();
  let vestidos = 0;
  let marcados = 0;
  for (const l of linhas) {
    let e;
    try { e = JSON.parse(l.estado); } catch { continue; }
    const r = aplicar(e, l.sexo);
    if (!r) continue;
    await B.regravarEstadoPersonagem(l.id, e); // sem mexer no "visto por último"
    if (r === 'vestiu') vestidos++;
    else marcados++;
  }
  return { vestidos, marcados };
}
