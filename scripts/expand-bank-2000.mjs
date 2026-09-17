/** Original focused practice: deterministic variants, not official ACT items.
 * Run with --write to materialize. Default validates without modifying data.
 * Re-running replaces only this batch's own IDs, preserving all older content.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readingSets } from './expansion-reading.mjs';

const dir = fileURLToPath(new URL('../src/content/', import.meta.url));
const files = { english: 'English', math: 'Math', reading: 'Reading', science: 'Science' };
const added = Object.fromEntries(Object.keys(files).map((s) => [s, []]));
const passages = { reading: [], science: [] };
const key = (i) => 'ABCD'[i];
const fmt = (x) => (Number.isInteger(x) ? String(x) : String(Number(x.toFixed(5))));
function question(section, topic, context, options, passage, difficulty = 'medium') {
  // Each pair is [choice, explanation]; correct answer is authored first.
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map((o) => String(o[0]).trim())).size, 4, context);
  const n = added[section].length;
  const shift = n % 4;
  const rotated = options.map((_, i) => options[(i - shift + 4) % 4]);
  added[section].push({
    id: `exp26-${section}-${String(n + 1).padStart(3, '0')}`,
    section,
    topic,
    difficulty,
    context,
    practiceOnly: true,
    ...(passage ? { passage } : {}),
    choices: rotated.map((o, i) => ({ id: key(i), text: String(o[0]) })),
    answer: key(shift),
    why: Object.fromEntries(rotated.map((o, i) => [key(i), o[1]])),
  });
}
function math(topic, prompt, values, explanation, errors, difficulty = 'medium') {
  question(
    'math',
    topic,
    prompt,
    values.map((v, i) => [
      typeof v === 'number' ? fmt(v) : v,
      i === 0 ? explanation : errors[i - 1],
    ]),
    undefined,
    difficulty,
  );
}

// Twenty skill families; twelve numerically distinct cases in each family.
for (let j = 1; j <= 12; j++) {
  const a = j + 22,
    b = j + 25,
    x = j + 23;
  math(
    'linear equations',
    `If ${a}x + ${b} = ${a * x + b}, what is x?`,
    [x, a * x, x + 1, -x],
    `Subtract ${b}, then divide by ${a}: x = ${x}.`,
    [
      `${a * x} is ${a}x; divide by the coefficient.`,
      `Substitution gives ${a * (x + 1) + b}, not ${a * x + b}.`,
      'Subtracting the constant does not make the solution negative.',
    ],
  );
  math(
    'systems',
    `The equations x + y = ${x + a} and 2x + y = ${2 * x + a} hold. What is y?`,
    [a, x, x + a, -a],
    `Subtract the first equation from the second to get x = ${x}; then y = ${x + a} - ${x} = ${a}.`,
    [
      'This is x, not y.',
      'This is the sum of both variables.',
      'Substitution with this negative value does not satisfy both equations.',
    ],
  );
  const price = 40 + 20 * j,
    discount = [10, 20, 25, 30][j % 4];
  math(
    'fractions & percents',
    `A backpack costs $${price}. A store discounts it by ${discount}%. Before tax, how many dollars does it cost?`,
    [price * (1 - discount / 100), (price * discount) / 100, price + discount, price],
    `The remaining fraction is ${1 - discount / 100}; multiply ${price} by this fraction.`,
    [
      'This is the amount saved, not the amount paid.',
      'A percentage discount is not a fixed number of dollars added.',
      'This is the original price before the discount.',
    ],
  );
  math(
    'functions',
    `For f(t) = ${a}t² - ${b}, what is f(3)?`,
    [9 * a - b, 3 * a - b, 9 * a + b, (3 * a) ** 2 - b],
    `Square the input first: ${a}(9) - ${b} = ${9 * a - b}.`,
    [
      'The input must be squared.',
      'The constant is subtracted, not added.',
      'Only t is squared, not the coefficient.',
    ],
  );
  math(
    'coordinate geometry',
    `What is the slope of the line through (${j}, ${a}) and (${j + 4}, ${a + 4 * b})?`,
    [b, 1 / b, 4 * b, b + 1],
    `Slope = (${a + 4 * b} - ${a}) / (${j + 4} - ${j}) = ${b}.`,
    [
      'This reverses rise and run.',
      'This is the rise without division by the run.',
      'Use the difference of the y-coordinates divided by the difference of the x-coordinates.',
    ],
  );
  const mean = j + 8;
  math(
    'statistics',
    `Four numbers have mean ${mean}. Three of the numbers are ${mean - 3}, ${mean + 1}, and ${mean + 4}. What is the fourth?`,
    [mean - 2, mean, 4 * mean, mean + 2],
    `All four sum to ${4 * mean}. The known sum is ${3 * mean + 2}, leaving ${mean - 2}.`,
    [
      'The missing number need not equal the mean.',
      'This is the required total of all four.',
      'The three given numbers are above their target total by 2, so subtract 2.',
    ],
  );
  math(
    'probability',
    `A bag holds ${a} blue tiles and ${b} red tiles. One tile is chosen uniformly at random. What is the probability of choosing blue?`,
    [`${a}/${a + b}`, `${b}/${a + b}`, `${a}/${b}`, `1/${a + b}`],
    `There are ${a} favorable outcomes among ${a + b} equally likely tiles.`,
    [
      'This is the probability of red.',
      'The denominator must include both colors.',
      'There is more than one blue tile.',
    ],
  );
  math(
    'area & volume',
    `A rectangular storage box has interior dimensions ${a} cm by ${b} cm by 4 cm. What is its volume in cm³?`,
    [4 * a * b, a * b, 2 * (a + b + 4), 2 * (a * b + 4 * a + 4 * b)],
    `Multiply all three perpendicular dimensions: ${a} × ${b} × 4 = ${4 * a * b}.`,
    [
      'This is the area of the base only.',
      'Adding edge lengths does not give volume.',
      'This is surface area in square centimeters.',
    ],
  );
  math(
    'triangles',
    `A right triangle has legs ${3 * j} and ${4 * j}. What is its hypotenuse?`,
    [5 * j, 7 * j, j, 25 * j * j],
    `By the Pythagorean theorem, c² = ${9 * j * j} + ${16 * j * j} = ${25 * j * j}; c = ${5 * j}.`,
    [
      'The hypotenuse is not the sum of the legs.',
      'The difference of the legs is not the hypotenuse.',
      'This is c²; take its positive square root.',
    ],
  );
  math(
    'quadratics',
    `What is the larger solution of (x - ${a})(x - ${b}) = 0?`,
    [b, a, -b, a + b],
    `A product is zero when a factor is zero; the roots are ${a} and ${b}, and ${b} is larger.`,
    [
      'This is the smaller solution.',
      'Setting x minus a number to zero gives that positive number.',
      'The sum of the roots is not itself a root here.',
    ],
  );
  math(
    'sequences',
    `An arithmetic sequence begins ${a}, ${a + 3}, ${a + 6}, …. What is its ${j + 4}th term?`,
    [a + 3 * (j + 3), a + 3 * (j + 4), a + j + 3, a],
    `Add the common difference 3 exactly ${j + 3} times to the first term.`,
    [
      'This adds one extra common difference.',
      'Each step adds 3, not 1.',
      'This is only the first term; add the common difference for subsequent terms.',
    ],
  );
  math(
    'exponents & radicals',
    `For nonzero x, simplify x^${a + 3} / x^${a}.`,
    ['x³', `x^${2 * a + 3}`, `x^${a + 1}`, '3x'],
    `Subtract exponents with a common base: (${a + 3}) - ${a} = 3.`,
    [
      'Adding exponents is the rule for multiplication, not division.',
      'The denominator exponent must be subtracted.',
      'An exponent of 3 means three factors of x.',
    ],
  );
  math(
    'circles',
    `A circle has radius ${a} cm. What is its circumference in centimeters?`,
    [`${2 * a}π`, `${a}π`, `${a * a}π`, `${4 * a * a}π`],
    `Circumference is 2πr = ${2 * a}π.`,
    [
      'This omits the factor 2.',
      'This is the area, not circumference.',
      'This uses an area formula with the diameter substituted for the radius.',
    ],
  );
  math(
    'lines & angles',
    `Two supplementary angles measure (${a}x)° and (${b}x)°. What is x?`,
    [180 / (a + b), 90 / (a + b), 360 / (a + b), 180 / (b - a)],
    `Supplementary angles sum to 180°, so (${a} + ${b})x = 180. The decimal choices are rounded to five places.`,
    [
      'This uses 90°, appropriate for complementary angles.',
      'Supplementary angles do not total a full turn.',
      'Add the angle expressions; do not subtract them.',
    ],
  );
  math(
    'word problems',
    `A printing service charges $${b} plus $${a} per poster. What is the total cost, in dollars, of ${x} posters?`,
    [b + a * x, (b + a) * x, a * x, b + a + x],
    `Pay the fixed charge once, plus ${x} charges of $${a}: ${b} + ${a}(${x}).`,
    [
      'This charges the fixed fee for every poster.',
      'This omits the fixed fee.',
      'Multiply the per-poster rate by the number of posters.',
    ],
  );
  const n = j + 1;
  math(
    'trigonometry',
    `An acute angle θ is in a right triangle. Its opposite leg is ${3 * n}, its adjacent leg is ${4 * n}, and its hypotenuse is ${5 * n}. What is tan θ?`,
    ['3/4', '3/5', '4/5', '4/3'],
    'Tangent is opposite divided by adjacent, so 3/4 after canceling the common factor.',
    ['This is sine.', 'This is cosine.', 'This reverses opposite and adjacent.'],
  );
  math(
    'logarithms',
    `If the logarithm of x to base 3 equals ${j + 1}, which expression equals x?`,
    [`3^${j + 1}`, `3 × ${j + 1}`, `3 + ${j + 1}`, `3^${j + 2}`],
    `Logarithmic form converts to x = 3^${j + 1}.`,
    [
      'Multiplication does not undo a logarithm.',
      'Addition does not undo a logarithm.',
      'This uses an exponent one too large.',
    ],
  );
  math(
    'matrices',
    `Let A = [[${a}, 2], [3, ${b}]]. What is the determinant of A?`,
    [a * b - 6, a * b + 6, a + b - 5, 6 - a * b],
    `For [[a,b],[c,d]], determinant = ad - bc: ${a}(${b}) - 2(3).`,
    [
      'Subtract the cross product instead of adding.',
      'Multiply entries along diagonals; do not sum them.',
      'This reverses the order of the two diagonal products.',
    ],
    'hard',
  );
  math(
    'complex numbers',
    `What is the real part of (${a} + 2i)(3 + ${b}i), where i² = -1?`,
    [3 * a - 2 * b, 3 * a + 2 * b, a * b + 6, 3 * a],
    `The real terms are ${3 * a} + ${2 * b}i² = ${3 * a - 2 * b}.`,
    [
      'Use i² = -1, not +1.',
      'This is the coefficient of i.',
      'This omits the real contribution from multiplying the imaginary terms.',
    ],
    'hard',
  );
  const factor = j + 20;
  math(
    'number properties',
    `What is the greatest common factor of ${12 * factor} and ${18 * factor}?`,
    [6 * factor, 3 * factor, 36 * factor, 2 * factor],
    `Factor out ${factor}. Since gcd(12,18) = 6, the greatest common factor is ${6 * factor}.`,
    [
      'This divides both numbers but is not greatest.',
      'This is their least common multiple, not their greatest common factor.',
      'This is a common factor but not the greatest.',
    ],
  );
}

// Nine original settings, each practicing seventeen different language rules.
const settings = [
  ['Mina', 'The museum', 'the exhibits', 'catalog', 'the archive'],
  ['Leo', 'The garden', 'the seedlings', 'label', 'the greenhouse'],
  ['Asha', 'The theater', 'the costumes', 'repair', 'the workshop'],
  ['Theo', 'The library', 'the maps', 'sort', 'the reading room'],
  ['Nora', 'The observatory', 'the lenses', 'clean', 'the laboratory'],
  ['Inez', 'The studio', 'the sketches', 'display', 'the gallery'],
  ['Omar', 'The station', 'the timetables', 'update', 'the office'],
  ['Wren', 'The school', 'the instruments', 'inspect', 'the music room'],
  ['Ravi', 'The center', 'the recordings', 'organize', 'the sound booth'],
];
function english(topic, prompt, correct, wrong, rule) {
  question('english', topic, prompt, [[correct, rule], ...wrong.map(([t, w]) => [t, w])]);
}
for (const [name, site, things, verb, room] of settings) {
  english(
    'subject-verb agreement',
    `Choose the verb that completes this sentence in standard English: "The collection of ${things.replace('the ', '')} ___ ready for inspection."`,
    'is',
    [
      [
        'are',
        'The head noun collection is singular; the plural noun in the of-phrase does not control the verb.',
      ],
      ['have been', 'A singular subject requires has been.'],
      ['were', 'The singular subject requires was in the past tense.'],
    ],
    'Collection is the singular subject, so is agrees with it.',
  );
  english(
    'verb tense',
    `"Yesterday, ${name} ___ ${things} before the doors opened." Which choice makes the sequence of past events clear?`,
    `had decided to ${verb}`,
    [
      [`will decide to ${verb}`, 'Future tense conflicts with the completed event yesterday.'],
      [`has decided to ${verb}`, 'Present perfect does not fit this completed past time frame.'],
      [`is deciding to ${verb}`, 'Present progressive conflicts with yesterday.'],
    ],
    'Past perfect marks a decision made before another past event.',
  );
  english(
    'commas',
    `Which version correctly punctuates the clause about ${name} preparing to ${verb} ${things}?`,
    `Before ${name} could ${verb} ${things}, the lights went out.`,
    [
      [
        `Before ${name} could ${verb}, ${things} the lights went out.`,
        'This separates the verb from its object.',
      ],
      [
        `Before, ${name} could ${verb} ${things} the lights went out.`,
        'Do not place a comma immediately after Before here.',
      ],
      [
        `Before ${name}, could ${verb} ${things} the lights went out.`,
        'This separates a subject from its verb.',
      ],
    ],
    'Put the comma after the complete introductory dependent clause, not inside it.',
  );
  english(
    'apostrophes',
    `The following sentence refers to exactly one curator: "${name} followed the ___ instructions to ${verb} ${things}." Which choice is correct?`,
    "curator's",
    [
      ['curators', 'A plural noun does not show singular possession.'],
      ["curators'", 'This indicates possession by multiple curators.'],
      ['curator', 'This does not mark the instructions as belonging to the curator.'],
    ],
    'A singular possessive noun takes apostrophe + s.',
  );
  english(
    'pronouns',
    `"The director asked ${name} and ___ to ${verb} ${things}." Which pronoun is correct?`,
    'me',
    [
      ['I', 'The pronoun is an object of asked, not the subject.'],
      ['myself', 'A reflexive pronoun needs an appropriate antecedent; I is not the subject here.'],
      ['mine', 'Mine expresses possession, not an object receiving a request.'],
    ],
    'Remove the other name: the director asked me. The compound object uses the same case.',
  );
  english(
    'modifiers',
    `Which sentence clearly indicates that ${name} was carrying a clipboard?`,
    `Carrying a clipboard, ${name} entered ${room}.`,
    [
      [
        `Carrying a clipboard, ${room} welcomed ${name}.`,
        'The introductory modifier attaches to the room.',
      ],
      [
        `Carrying a clipboard, the door opened for ${name}.`,
        'The modifier incorrectly describes the door.',
      ],
      [
        `Carrying a clipboard, the arrival of ${name} was noticed.`,
        'An arrival cannot carry a clipboard.',
      ],
    ],
    'Place the person doing the action immediately after the introductory modifier.',
  );
  english(
    'parallelism',
    `"${name} planned to ${verb} ${things}, check the schedule, and ___." Which choice maintains parallel structure?`,
    'lock the door',
    [
      ['locking the door', 'An -ing form does not match the two bare verbs governed by to.'],
      ['the door was locked', 'A complete clause does not match the verb phrases.'],
      ['a locked door', 'A noun phrase does not complete the parallel series.'],
    ],
    'The shared to governs three parallel verbs: to organize the items, check, and lock.',
  );
  english(
    'colons',
    `Which sentence about ${site.toLowerCase()} uses a colon correctly?`,
    `${site} needed one thing: a new schedule.`,
    [
      [`${site} needed: a new schedule.`, 'The colon interrupts a verb and its direct object.'],
      [`${site}: needed a new schedule.`, 'The colon separates the subject from its verb.'],
      [`${site} needed a: new schedule.`, 'The colon splits a noun phrase.'],
    ],
    'The words before the colon form a complete sentence; the words after it identify the one thing.',
  );
  english(
    'run-ons',
    `Which version correctly joins the clauses about ${name}'s arrival at ${site.toLowerCase()}?`,
    `${name} arrived early; ${site.toLowerCase()} was still closed.`,
    [
      [
        `${name} arrived early, ${site.toLowerCase()} was still closed.`,
        'A comma alone creates a comma splice.',
      ],
      [
        `${name} arrived early ${site.toLowerCase()} was still closed.`,
        'This fuses two independent clauses without punctuation.',
      ],
      [
        `${name} arrived early; but, ${site.toLowerCase()} was still closed.`,
        'The comma after but is unnecessary, and the coordinated clauses should use a comma before but.',
      ],
    ],
    'A semicolon can join two closely related independent clauses.',
  );
  english(
    'fragments',
    `Which choice about ${name}'s visit to ${site.toLowerCase()} is a complete sentence?`,
    `${name} stayed until ${site.toLowerCase()} closed.`,
    [
      [
        `Because ${name} stayed until closing.`,
        'Because makes this dependent, with no main clause.',
      ],
      [
        `While ${name} waited outside ${room}.`,
        'While introduces a dependent clause without a main clause.',
      ],
      [`${name}, waiting outside ${room}.`, 'The participle waiting is not a finite main verb.'],
    ],
    'The independent clause has the subject and finite verb stayed; the until clause adds detail.',
  );
  english(
    'wordiness',
    `Choose the most concise replacement for the bracketed words without losing meaning: "${name} returned [at a later point in time] to ${verb} ${things}."`,
    'later',
    [
      ['at a later future time', 'Later and future repeat the same time relationship.'],
      ['later on in time', 'On in time adds no useful meaning.'],
      ['subsequently at a later time', 'Subsequently and at a later time duplicate each other.'],
    ],
    'Later preserves the full time relationship in one word.',
  );
  english(
    'transitions',
    `"${name} expected ${site.toLowerCase()} to be empty. ___, every seat was taken." Which transition best expresses the relationship?`,
    'Instead',
    [
      [
        'Therefore',
        'The second sentence contradicts the expectation rather than resulting from it.',
      ],
      ['Similarly', 'The observed crowd is not similar to the expectation of emptiness.'],
      ['For example', 'A full room does not illustrate an expectation that it would be empty.'],
    ],
    'Instead signals that the actual situation differs from the expectation.',
  );
  english(
    'word choice',
    `"The new timetable will ___ how ${name} plans the day." Which choice fits standard usage?`,
    'affect',
    [
      ['effect', 'The intended verb means influence, not bring into existence.'],
      ['effects', 'A base-form verb follows will.'],
      ['affects', 'Will takes the base form rather than the third-person singular.'],
    ],
    'Affect is the verb meaning influence, and will is followed by its base form.',
  );
  english(
    'idioms',
    `"${name} is responsible ___ maintaining ${things}." Which choice completes the standard expression?`,
    'for',
    [
      ['of', 'The standard expression is responsible for, not responsible of.'],
      ['to', 'Responsible to typically identifies the person one answers to, not the task.'],
      ['with', 'Responsible with is not the standard construction for an assigned duty.'],
    ],
    'Responsible for names the task or duty assigned to someone.',
  );
  english(
    'adding/deleting',
    `A paragraph explains how ${name} learned to ${verb} ${things}. The writer proposes adding "${name}'s cousin prefers rainy weather." Should the sentence be added?`,
    'No, because the weather preference does not explain the learning process.',
    [
      [
        'Yes, because any personal fact clarifies a technical process.',
        'A personal fact must be relevant to clarify the process.',
      ],
      [
        'Yes, because it identifies the cause of the successful training.',
        'The sentence does not connect the cousin or weather to the training.',
      ],
      [
        'No, because a process paragraph cannot mention people.',
        'People can be relevant to processes; irrelevance is the actual problem.',
      ],
    ],
    'The proposed detail has no stated connection to the paragraph’s purpose.',
  );
  english(
    'sentence order',
    `Arrange these sentences logically: [1] Finally, ${name} returned the key. [2] First, ${name} unlocked ${room}. [3] Once inside, ${name} began to ${verb} ${things}.`,
    '2, 3, 1',
    [
      ['1, 2, 3', 'Returning the key is marked Finally and belongs at the end.'],
      ['3, 2, 1', 'Once inside presupposes that the room has already been unlocked.'],
      ['2, 1, 3', 'This puts the final action before the activity inside the room.'],
    ],
    'First introduces unlocking, Once inside follows entry, and Finally closes the sequence.',
  );
  english(
    'dashes',
    `Which version correctly sets off "a patient volunteer" in the sentence about ${name} helping to ${verb} ${things}?`,
    `${name}—a patient volunteer—helped ${verb} ${things}.`,
    [
      [
        `${name}—a patient volunteer helped ${verb} ${things}.`,
        'The interrupting phrase opens with a dash but is not closed.',
      ],
      [
        `${name}, a patient volunteer—helped ${verb} ${things}.`,
        'The interruption must use a matched pair of commas or dashes.',
      ],
      [
        `${name}—a patient volunteer, helped ${verb} ${things}.`,
        'The opening dash and closing comma form an unmatched pair.',
      ],
    ],
    'Paired dashes surround the complete interruption; the underlying sentence remains grammatical.',
  );
}

// Reading sets are wholly original short skill passages; not full test passages.
for (const [i, set] of readingSets.entries()) {
  const id = `exp26-rp-${i + 1}`;
  passages.reading.push({
    id,
    type: set.type,
    title: set.title,
    blurb: 'Original short passage for focused reading practice.',
    text: set.text,
  });
  for (const item of set.questions) question('reading', item.topic, item.prompt, item.options, id);
}

// Synthetic experimental observations: no claims about real measured studies.
const experiments = [
  ['lamp distance', 'cm', 'sensor reading', 'units', 'a light sensor', 'the same lamp and sensor'],
  [
    'filter layers',
    'layers',
    'collected particles',
    'particles',
    'a filter collector',
    'the same incoming particle mixture and collection time',
  ],
  [
    'stirring time',
    's',
    'dissolved mass',
    'g',
    'a mixing container',
    'the same liquid volume and starting solid',
  ],
  [
    'panel tilt',
    'degrees',
    'power output',
    'mW',
    'a model solar panel',
    'the same light source and panel',
  ],
  [
    'insulation thickness',
    'mm',
    'temperature decrease',
    '°C',
    'an insulated container',
    'the same starting temperature and observation time',
  ],
];
for (let k = 0; k < 20; k++) {
  const [factor, unit, result, resultUnit, device, controls] = experiments[k % 5];
  const base = 12 + 2 * k,
    delta = k % 5 === 0 || k % 5 === 4 ? -2 : 3;
  const xs = [2, 4, 6, 8],
    ys = xs.map((_, i) => base + delta * i);
  const id = `exp26-sp-${k + 1}`;
  passages.science.push({
    id,
    type: 'Research Summaries',
    title: `Model study ${k + 1}: ${factor}`,
    blurb: 'A synthetic dataset for data interpretation; values are stipulated for this exercise.',
    text: `A class tested ${device}. Students changed ${factor} while keeping ${controls}. For each setting, they used three fresh trials and recorded the mean ${result}. The same measuring procedure was used for every trial.\n\nStudent A proposes that ${result} changes by a constant amount for every 2-${unit} increase within the tested range. Student B proposes that the ${result} remains the same at every setting. The class has not tested settings outside the table. Measurement variation between trials is not shown.`,
    figures: [
      {
        type: 'table',
        label: 'Table 1',
        caption: 'Observed means across three trials per setting',
        head: [`${factor} (${unit})`, `${result} (${resultUnit})`],
        rows: xs.map((x, i) => [String(x), String(ys[i])]),
      },
    ],
  });
  question(
    'science',
    'reading data',
    `At ${factor} of 6 ${unit}, what mean ${result} was recorded?`,
    [
      [`${ys[2]} ${resultUnit}`, 'Read the entry for the setting of 6.'],
      [`${ys[0]} ${resultUnit}`, 'This belongs to the setting of 2.'],
      [`${ys[1]} ${resultUnit}`, 'This belongs to the setting of 4.'],
      [`${ys[3]} ${resultUnit}`, 'This belongs to the setting of 8.'],
    ],
    id,
    'easy',
  );
  question(
    'science',
    'research summaries',
    'Which quantity did students deliberately vary?',
    [
      [factor, `The passage identifies ${factor} as the changed factor.`],
      [result, `This was the measured response, not the variable deliberately set.`],
      ['the number of trials per setting', 'Every setting used three trials.'],
      ['the measuring procedure', 'The passage states that the same procedure was used.'],
    ],
    id,
  );
  question(
    'science',
    'calculating from data',
    `What is the change in mean ${result} when ${factor} increases from 2 to 8 ${unit}? Use final minus initial.`,
    [
      [`${3 * delta} ${resultUnit}`, `${ys[3]} - ${ys[0]} = ${3 * delta}.`],
      [`${delta} ${resultUnit}`, 'This is the change for a single step, not all three steps.'],
      [`${-3 * delta} ${resultUnit}`, 'This reverses final and initial.'],
      [`${ys[3] + ys[0]} ${resultUnit}`, 'A change is a difference, not a sum.'],
    ],
    id,
  );
  question(
    'science',
    'conflicting viewpoints',
    'Which statement best describes how the table relates to the two students’ proposals?',
    [
      [
        'It supports A within the tested range and contradicts B.',
        `Successive means differ by ${delta}, rather than remaining constant.`,
      ],
      ['It supports B and contradicts A.', 'The means change by equal nonzero differences.'],
      [
        'It contradicts both because the means are all different.',
        'Different means can support a constant change per step.',
      ],
      [
        'It proves A is correct for every possible setting.',
        'A finite tested range cannot establish behavior at every possible setting.',
      ],
    ],
    id,
  );
  question(
    'science',
    'hypotheses',
    `If the observed constant change continues to 10 ${unit}, what mean ${result} would A predict?`,
    [
      [
        `${base + 4 * delta} ${resultUnit}`,
        `One additional step adds ${delta} to ${ys[3]}; this is a conditional prediction, not a measurement.`,
      ],
      [
        `${ys[3]} ${resultUnit}`,
        'This assumes the response stops changing after the last measured setting.',
      ],
      [
        `${base + 5 * delta} ${resultUnit}`,
        'This advances two steps beyond the last setting instead of one.',
      ],
      [`${base - delta} ${resultUnit}`, 'This extends the pattern backward rather than forward.'],
    ],
    id,
  );
}

assert.deepEqual(
  Object.values(added).map((a) => a.length),
  [153, 240, 100, 100],
);
const results = {};
for (const [section, suffix] of Object.entries(files)) {
  const original = JSON.parse(readFileSync(`${dir}questions${suffix}.json`, 'utf8'));
  const retained = original.filter((q) => !q.id.startsWith(`exp26-${section}-`));
  results[`questions${suffix}.json`] = [...retained, ...added[section]];
}
for (const section of ['reading', 'science']) {
  const name = `passages${files[section]}.json`;
  const retained = JSON.parse(readFileSync(dir + name, 'utf8')).filter(
    (p) => !p.id.startsWith('exp26-'),
  );
  results[name] = [...retained, ...passages[section]];
}
const mini = Object.values(JSON.parse(readFileSync(dir + 'miniquizzes.json', 'utf8'))).flat()
  .length;
const total = Object.keys(files).reduce(
  (n, s) => n + results[`questions${files[s]}.json`].length,
  mini,
);
assert(total >= 2000, 'Expansion must reach at least 2000 while preserving subsequent additions.');
const fingerprints = new Set();
for (const q of Object.values(added).flat()) {
  const fingerprint = JSON.stringify([q.passage, q.context, q.choices.map((c) => c.text).sort()]);
  assert(!fingerprints.has(fingerprint), `Duplicate exercise: ${q.id}`);
  fingerprints.add(fingerprint);
}
if (process.argv.includes('--write')) {
  writeFileSync(
    dir + 'expansion.json',
    JSON.stringify({ questions: added, passages }, null, 2) + '\n',
  );
}
console.log(
  `Expansion validated: 593 original focused-practice items; ${total} total questions. ${process.argv.includes('--write') ? 'Files written.' : 'No files changed.'}`,
);
