/* Packs embutidos no Worker. Pack novo em packs/ → acrescente uma linha aqui
   (o teste "todo pack da pasta está no catálogo" avisa se esquecer). */
import type { Catalogo } from '@lab/nucleo';
import base from '../../../packs/base.json';
import solarB2c from '../../../packs/solar-b2c.json';

export const CATALOGO: Catalogo = {
  base,
  'solar-b2c': solarB2c,
};
