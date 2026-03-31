/**
 * Los Nombres del Bosque — Shared Tree Data
 * Single source of truth for all 16 trees.
 * Used by quiz.html, tree pages, and homepage.
 */

var LNDB = (function () {
  'use strict';

  // Canonical book order
  var treeOrder = [
    'yarumo', 'guayacanA', 'cenizo', 'nogal', 'caimito', 'roble',
    'tamarindo', 'cerezo', 'palma', 'arrayan', 'ceiba', 'guayacanR',
    'mango', 'cacao', 'eucalipto', 'copal'
  ];

  var trees = {
    yarumo: {
      name: 'Yarumo',
      slug: 'yarumo',
      blurb: 'La calma',
      illustration: 'Yarumo.png',
      backgroundFile: 'Yarumo 2.jpg',
      hasMeditation: false,
      biome: 'cloud-forest',
      accentColor: '#7E8E6D',
      completionMessage: 'Gracias por quedarte bajo mi sombra. Lleva esta calma contigo.'
    },
    guayacanA: {
      name: 'Guayacán Amarillo',
      slug: 'guayacan-amarillo',
      blurb: 'La alegría',
      illustration: 'GuayacanA.png',
      backgroundFile: 'Guayacan_A. 2.jpg',
      hasMeditation: false,
      biome: 'flowering',
      accentColor: '#D4A03C',
      completionMessage: 'Que mi luz te acompane. Florece sin miedo, una y otra vez.'
    },
    cenizo: {
      name: 'Cenizo',
      slug: 'cenizo',
      blurb: 'La serenidad',
      illustration: 'Cenizo.png',
      backgroundFile: 'Cenizo 2.jpg',
      hasMeditation: false,
      biome: 'dry',
      accentColor: '#8A9B7A',
      completionMessage: 'En el silencio encontraste lo que buscabas. Ahora llevalo contigo.'
    },
    nogal: {
      name: 'Nogal Cafetero',
      slug: 'nogal',
      blurb: 'La sabiduría',
      illustration: 'Nogal.png',
      backgroundFile: 'Nogal_Cafetero 2.jpg',
      hasMeditation: false,
      biome: 'temperate',
      accentColor: '#6B5B3E',
      completionMessage: 'Cuida a quienes amas como yo cuido mis raices. Con paciencia. Con amor.'
    },
    caimito: {
      name: 'Caimito',
      slug: 'caimito',
      blurb: 'La dulzura',
      illustration: 'Caimito.png',
      backgroundFile: 'Caimito_ 2.jpg',
      hasMeditation: false,
      biome: 'cloud-forest',
      accentColor: '#7B6D8A',
      completionMessage: 'Mi dulzura vive en ti. Compartela con quienes mas la necesitan.'
    },
    roble: {
      name: 'Roble',
      slug: 'roble',
      blurb: 'La fortaleza',
      illustration: 'Roble.png',
      backgroundFile: 'Roble_2.jpg',
      hasMeditation: false,
      biome: 'mountain',
      accentColor: '#5C6B4A',
      completionMessage: 'Permanece. Como yo, aprende que la fuerza verdadera esta en las raices.'
    },
    tamarindo: {
      name: 'Tamarindo',
      slug: 'tamarindo',
      blurb: 'El humor',
      illustration: 'Tamarindo.png',
      backgroundFile: 'Tamarindo.jpg',
      hasMeditation: false,
      biome: 'tropical',
      accentColor: '#C4855E',
      completionMessage: 'La vida sabe mejor cuando la compartes. Ve, y haz reir a alguien hoy.'
    },
    cerezo: {
      name: 'Cerezo',
      slug: 'cerezo',
      blurb: 'La belleza',
      illustration: 'Cerezo.png',
      backgroundFile: 'Cerezo_2.jpg',
      hasMeditation: false,
      biome: 'flowering',
      accentColor: '#C4758E',
      completionMessage: 'Como mis petalos, deja que tu belleza caiga donde mas se necesita.'
    },
    palma: {
      name: 'Palma de Cera',
      slug: 'palma-cera',
      blurb: 'La dignidad',
      illustration: 'PalmaCera.png',
      backgroundFile: 'Palma_Cera_2.jpg',
      hasMeditation: false,
      biome: 'mountain',
      accentColor: '#5A7A5C',
      completionMessage: 'Sigue creciendo hacia arriba. La altura no es soledad — es perspectiva.'
    },
    arrayan: {
      name: 'Arrayán',
      slug: 'arrayan',
      blurb: 'El hogar',
      illustration: 'Arrayan.png',
      backgroundFile: 'Arrayan_2.jpg',
      hasMeditation: false,
      biome: 'flowering',
      accentColor: '#8E7E6D',
      completionMessage: 'Mi aroma es mi regalo. Encuentra el tuyo y regalalo al mundo.'
    },
    ceiba: {
      name: 'Ceiba',
      slug: 'ceiba',
      blurb: 'El abrazo',
      illustration: 'Ceiba.png',
      backgroundFile: 'Ceiba 2.jpg',
      hasMeditation: false,
      biome: 'temperate',
      accentColor: '#4A6B5C',
      completionMessage: 'Gracias por escucharme. Lleva este momento contigo.'
    },
    guayacanR: {
      name: 'Guayacán Rosado',
      slug: 'guayacan-rosado',
      blurb: 'La magia',
      illustration: 'GuayacanR.png',
      backgroundFile: 'GuayacanR.jpg',
      hasMeditation: false,
      biome: 'flowering',
      accentColor: '#C47588',
      completionMessage: 'El mundo se detiene cuando floreces. No dejes de hacerlo.'
    },
    mango: {
      name: 'Mango',
      slug: 'mango',
      blurb: 'La generosidad',
      illustration: 'Mango.png',
      backgroundFile: 'Mango 2.jpg',
      hasMeditation: false,
      biome: 'tropical',
      accentColor: '#C4A03C',
      completionMessage: 'Da sin medida. La generosidad es la raiz de toda abundancia.'
    },
    cacao: {
      name: 'Cacao',
      slug: 'cacao',
      blurb: 'La ternura',
      illustration: 'Cacao.png',
      backgroundFile: 'Cacao 2.jpg',
      hasMeditation: false,
      biome: 'tropical',
      accentColor: '#6B4A3E',
      completionMessage: 'Lo mas valioso no siempre se ve a primera vista. Tu lo sabes bien.'
    },
    eucalipto: {
      name: 'Eucalipto',
      slug: 'eucalipto',
      blurb: 'La respiración',
      illustration: 'Eucalipto.png',
      backgroundFile: 'Eucalipto.jpg',
      hasMeditation: false,
      biome: 'temperate',
      accentColor: '#5C8A7A',
      completionMessage: 'Sana primero tu espiritu. Despues, el mundo sanara contigo.'
    },
    copal: {
      name: 'Copal',
      slug: 'copal',
      blurb: 'La luz sagrada',
      illustration: 'Copal.png',
      backgroundFile: 'Copal 2.jpg',
      hasMeditation: false,
      biome: 'dry',
      accentColor: '#8A7A5C',
      completionMessage: 'Tu presencia es un ritual. Donde vayas, eleva el espiritu de quienes te rodean.'
    }
  };

  var descriptions = {
    yarumo: 'Imagina un ser que no necesita gritar para que lo escuchen. Así eres tú: una presencia serena que cobija sin pedir nada a cambio. Como el Yarumo, tu sombra es generosa, tu silencio es un regalo, y quienes se acercan a ti encuentran paz sin saber bien porqué. Caminas por el mundo con los pies firmes y el corazón abierto, regalando calma a cada paso.',
    guayacanA: 'Hay personas que al llegar iluminan todo, como si cargaran un pedacito de sol entre las manos. Eso eres tú: luz que no se apaga ni en los días grises. Como el Guayacán Amarillo, tu presencia es una celebración. Floreces con fuerza, con alegría, y cada vez que el mundo necesita color, ahí estas tú, recordándole que la belleza siempre vuelve.',
    cenizo: 'Eres de los que observan antes de hablar, de los que entienden sin que les expliquen. Como el Cenizo, habitas el silencio con elegancia. Tu fuerza no está en el ruido sino en la profundidad. Eres un refugio discreto, un alma que acompaña sin invadir, y quienes te conocen de verdad saben que en tu quietud vive una sabiduría que pocos alcanzan.',
    nogal: 'Proteger es tu forma de amar. Como el Nogal Cafetero, cargas en tus ramas la responsabilidad de guiar, de enseñar, de cuidar a quienes crecen a tu sombra. Eres paciente como la tierra y sabio como las raíces que nadie ve. Tu generosidad no tiene prisa: das lo mejor de ti poco a poco, como quien sabe que lo que se siembra con amor siempre da frutos.',
    caimito: 'Dulzura pura, eso es lo que eres. Como el Caimito, das lo mejor de ti sin pensarlo dos veces. Tu cariño es generoso, incondicional, y quienes prueban tu bondad no la olvidan jamás. Eres de esas almas que endulzan la vida de otros con gestos pequeños pero inolvidables: una palabra tierna, un abrazo largo, un "aquí estoy" que lo cambia todo.',
    roble: 'Cuando el mundo tiembla, tu permaneces. Como el Roble, tu fortaleza no es rigidez sino raíces profundas. Has aprendido que ser fuerte no es no sentir, sino seguir de pie cuando todo intenta derribarte. Eres el refugio al que vuelven los tuyos, el tronco que sostiene, la promesa silenciosa de que mientras estes ahí, nada se vendrá abajo.',
    tamarindo: 'La vida contigo sabe diferente: un poco acida, un poco dulce, siempre intensa. Como el Tamarindo, tienes el don de convertir cualquier momento en algo memorable. Tu risa es contagiosa, tu energía es inagotable, y donde llegas la fiesta comienza. Pero debajo de toda esa alegría hay un corazón sensible que sabe que la mejor medicina es hacer reír a quienes amas.',
    cerezo: 'Floreces de una manera que nadie puede ignorar. Como el Cerezo, tu belleza no es solo lo que se ve: es la forma en que haces sentir a los demás. Eres delicado/a, pero valiente, suave pero memorable. Cada vez que abres tu corazón es como una lluvia de pétalos que cubre todo de esperanza, recordándole al mundo que lo efímero puede ser lo más hermoso.',
    palma: 'Te elevas sin pedir permiso. Como la Palma de Cera, creces hacia arriba con una dignidad que impone respeto. Has conocido vientos fuertes y alturas solitarias, pero nada te ha doblado. Tu fuerza viene de adentro, de un lugar profundo donde habita la certeza de que fuiste hecho/a para resistir, para llegar alto, para tocar el cielo sin dejar de abrazar la tierra.',
    arrayan: 'Tu magia está en lo sutil. Como el Arrayán, no necesitas ser el más grande ni el más visible para transformar un lugar. Tu presencia es como un aroma que envuelve sin que uno sepa de donde viene: reconfortante, intima, inolvidable. Cuidas con delicadeza, amas con ternura, y quienes tienen la fortuna de conocerte descubren un mundo entero en tu aparente sencillez.',
    ceiba: 'Eres raíz y copa al mismo tiempo. Como la Ceiba, abrazas el mundo entero con tus ramas y al mismo tiempo te aferras a la tierra con una fuerza ancestral. Eres protector/a, imponente, sagrado/a para quienes te rodean. En ti caben todos: los que buscan refugio, los que necesitan sombra, los que quieren soñar. Eres el árbol al que todos quieren volver.',
    guayacanR: 'El mundo se detiene cuando floreces. Como el Guayacán Rosado, tu forma de ser es un espectáculo de belleza y alegría que nadie puede pasar de largo. Irradias felicidad, pintas de rosa los días grises, y tienes esa rara habilidad de hacer que cualquiera a tu lado se sienta especial. Tu corazón florece sin miedo, una y otra vez, como si supiera que la vida merece ser celebrada.',
    mango: 'Generosidad es tu segundo nombre. Como el Mango, das sin medida: sabor, frescura, alegría. Eres el amigo que siempre tiene la puerta abierta, la mesa puesta, la risa lista. Tu energía es contagiosa y tu corazón no conoce la mezquindad. Donde estas tu hay abundancia, porque entiendes que la vida es más dulce cuando se comparte con los demás.',
    cacao: 'Hay algo sagrado en lo que creas. Como el Cacao, transformas lo simple en algo extraordinario. Tu esencia es rica, profunda, imposible de replicar. No buscas ser el más llamativo, pero lo que ofreces al mundo tiene un valor que pocos entienden a primera vista. Eres el secreto mejor guardado: quien te descubre, te atesora para siempre.',
    eucalipto: 'Sanar es tu vocación silenciosa. Como el Eucalipto, tu presencia refresca, limpia, renueva. Eres de los que necesitan soledad para recargarse, de los que encuentran en su interior la medicina que luego comparten con el mundo. Tu espíritu es libre, tu aroma es inconfundible, y quienes se acercan a ti sienten que algo en ellos también sana.',
    copal: 'Tu alma está hecha de incienso y oración. Como el Copal, todo en ti invita a la pausa, a lo sagrado, a lo que no se puede tocar, pero se siente profundamente. Eres un ser espiritual que camina entre los demás regalando paz, conexión con algo más grande. Tu presencia es como un ritual: transforma el espacio, eleva el espíritu, y deja una huella que no se borra.'
  };

  // Quiz scoring data
  var questions = [
    {
      text: 'Como te describirian quienes te conocen bien?',
      answers: [
        { text: 'Tranquilo/a, generoso/a... no necesitas hablar para que se sienta tu presencia', scores: { yarumo: 3, cenizo: 2, eucalipto: 1 } },
        { text: 'Fuerte, firme... siempre estas cuando mas se te necesita', scores: { roble: 3, ceiba: 2, nogal: 2, palma: 1 } },
        { text: 'Luminoso/a, lleno/a de vida... alegras cualquier lugar con solo llegar', scores: { guayacanA: 3, guayacanR: 2, cerezo: 2 } },
        { text: 'Dulce, carinoso/a... das lo mejor de ti sin pensarlo', scores: { caimito: 3, cacao: 2, arrayan: 2, mango: 1 } }
      ]
    },
    {
      text: 'Como cuidas a quienes amas?',
      answers: [
        { text: 'Estando presente sin invadir. Dando espacio, dando sombra', scores: { yarumo: 3, eucalipto: 2, cenizo: 1 } },
        { text: 'Protegiendo, guiando, ensenando con paciencia', scores: { nogal: 3, roble: 2, ceiba: 2 } },
        { text: 'Con detalles pequenos, una palabra amable, un silencio que acompana', scores: { arrayan: 3, copal: 2, cenizo: 2 } },
        { text: 'Compartiendo lo mejor: risas, sabores, abrazos apretados', scores: { mango: 3, caimito: 2, tamarindo: 2, cacao: 1 } }
      ]
    },
    {
      text: 'Cuando la vida se pone dificil, tu...',
      answers: [
        { text: 'Te mantienes firme. No importa el viento, sigues de pie', scores: { roble: 3, palma: 3 } },
        { text: 'Encuentras la risa incluso en la tormenta', scores: { tamarindo: 3, guayacanR: 2, mango: 1 } },
        { text: 'Te refugias en tu interior para volver renovado/a', scores: { eucalipto: 3, cerezo: 2, cenizo: 2 } },
        { text: 'Abrazas mas fuerte a los tuyos', scores: { ceiba: 3, caimito: 2, arrayan: 2 } }
      ]
    },
    {
      text: 'En una reunion con amigos, tu...',
      answers: [
        { text: 'Escucho mas de lo que hablo. Me gusta observar', scores: { cenizo: 3, yarumo: 2, copal: 2, palma: 1 } },
        { text: 'Soy el alma de la fiesta. La musica, la risa, el baile', scores: { mango: 3, tamarindo: 2, guayacanR: 1 } },
        { text: 'Lleno el espacio de buena energia sin darme cuenta', scores: { guayacanA: 3, guayacanR: 2, cerezo: 2 } },
        { text: 'Me aseguro de que todos esten bien y comodos', scores: { nogal: 3, ceiba: 2, arrayan: 2, caimito: 1 } }
      ]
    },
    {
      text: 'Que valoras mas?',
      answers: [
        { text: 'La paz interior y la conexion con lo sagrado', scores: { copal: 3, eucalipto: 2, palma: 2 } },
        { text: 'La alegria, la fiesta, hacer reir a quienes amo', scores: { tamarindo: 3, mango: 2, guayacanR: 2 } },
        { text: 'La fortaleza para proteger a los mios', scores: { roble: 3, nogal: 2, ceiba: 1 } },
        { text: 'La ternura y el carino en las cosas simples', scores: { caimito: 3, arrayan: 2, cacao: 2, cenizo: 1 } }
      ]
    },
    {
      text: 'Tu forma de brillar es...',
      answers: [
        { text: 'Sin hacer ruido. Quien presta atencion, lo nota', scores: { arrayan: 3, cenizo: 2, copal: 2, yarumo: 1 } },
        { text: 'Con todo el color y la luz. No puedo evitarlo', scores: { guayacanA: 3, guayacanR: 3, cerezo: 2 } },
        { text: 'Desde las raices. Mi fuerza habla por mi', scores: { palma: 3, roble: 2, ceiba: 2, nogal: 1 } },
        { text: 'Creando algo unico que reconforta', scores: { cacao: 3, tamarindo: 2, mango: 1 } }
      ]
    },
    {
      text: 'Que quisieras que sintieran los demas cerca de ti?',
      answers: [
        { text: 'Paz, como sentarse bajo la sombra de un arbol grande', scores: { yarumo: 3, eucalipto: 2, copal: 2 } },
        { text: 'Ganas de sonreir. Que la vida es bella', scores: { guayacanR: 3, cerezo: 2, guayacanA: 2, tamarindo: 1 } },
        { text: 'Seguridad. Que siempre habra alguien cuidandolos', scores: { nogal: 3, roble: 2, ceiba: 2, palma: 1 } },
        { text: 'Calidez, como un abrazo o el olor a algo dulce', scores: { caimito: 3, cacao: 2, arrayan: 2, mango: 1 } }
      ]
    }
  ];

  // Helper: get tree by slug
  function getBySlug(slug) {
    for (var key in trees) {
      if (trees[key].slug === slug) return { key: key, tree: trees[key] };
    }
    return null;
  }

  // Helper: get next/prev tree in book order
  function getNextTree(currentKey) {
    var idx = treeOrder.indexOf(currentKey);
    var nextIdx = (idx + 1) % treeOrder.length;
    return treeOrder[nextIdx];
  }

  function getPrevTree(currentKey) {
    var idx = treeOrder.indexOf(currentKey);
    var prevIdx = (idx - 1 + treeOrder.length) % treeOrder.length;
    return treeOrder[prevIdx];
  }

  // Canvas text helper — wraps text to fit within maxWidth
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';
    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' ';
      var metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, y);
  }

  return {
    trees: trees,
    descriptions: descriptions,
    questions: questions,
    treeOrder: treeOrder,
    getBySlug: getBySlug,
    getNextTree: getNextTree,
    getPrevTree: getPrevTree,
    wrapText: wrapText
  };
})();
