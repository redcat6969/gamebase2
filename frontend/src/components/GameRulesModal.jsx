import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function Section({ title, children }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {title}
      </h3>
      <div className="text-sm text-slate-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function CommonGuessRules() {
  return (
    <>
      <Section title="О чём игра">
        <p>
          Это игра на воображение и совпадения. Все получают{' '}
          <strong className="text-slate-100">одну и ту же тему</strong> (вопрос) и
          одновременно (тайно друг от друга) вводят несколько слов-ассоциаций. Потом из общего «котла»
          всех слов показывают слова по одному — нужно понять, совпало ли ваше слово с
          тем, что на экране. Чем чаще вы находите друг друга в одних и тех же
          смыслах, тем больше очков.
        </p>
      </Section>
      <Section title="Сколько человек нужно">
        <p>
          Игра рассчитана на <strong className="text-slate-100">компанию от двух человек</strong>.
          Один участник может открыть комнату на большом экране и зайти как ведущий;
          остальные подключаются с телефонов по коду или QR.
        </p>
      </Section>
      <Section title="Как проходит партия">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Ведущий запускает игру и выбирает, сколько будет{' '}
            <strong className="text-slate-100">раундов с вопросами</strong> (каждый
            раунд — новая тема).
          </li>
          <li>
            Появляется <strong className="text-slate-100">вопрос</strong>. У каждого
            есть время ввести до <strong className="text-slate-100">пяти слов</strong>{' '}
            — что угодно: ассоциации, шутки, первое, что пришло в голову. Никто не
            видит чужие ответы до конца фазы ввода.
          </li>
          <li>
            Все слова собираются в <strong className="text-slate-100">общий набор</strong>.
            Дальше начинается серия «микро-раундов»: на экране по очереди показывается{' '}
            <strong className="text-slate-100">одно слово из этого набора</strong>.
          </li>
          <li>
            У каждого игрока на телефоне — свой список слов, которые он вводил. Нужно
            честно отметить: <strong className="text-slate-100">есть ли у вас на карточке
            совпадение</strong> с показанным словом (или что такого слова у вас в списке
            нет). Ответ отправляется сразу при выборе.
          </li>
          <li>
            Когда все ответили, подводится итог раунда и показывается следующее слово
            из общего набора, пока слова не закончатся. Затем начинается следующий
            большой раунд с <strong className="text-slate-100">новым вопросом</strong>, и
            снова ввод слов — и так столько раз, сколько раундов выбрал ведущий.
          </li>
        </ol>
      </Section>
      <Section title="Очки">
        <p>
          Если в одном микро-раунде <strong className="text-slate-100">как минимум два
          игрока</strong> правильно отметили совпадение со словом на экране, каждый из
          этих игроков получает очки (чем больше таких людей, тем больше очков за этот
          ход). Если совпал только один человек, очков за этот ход нет — но игра
          всё равно идёт дальше.
        </p>
        <p className="text-slate-500 text-xs mt-2">
          Подсказка: можно договариваться устно, что вы имели в виду под своим словом —
          важно лишь, чтобы при показе слова с экрана вы оба нажали «есть совпадение»,
          если смысл совпал.
        </p>
      </Section>
      <Section title="Кто победил">
        <p>
          В конце партии сравнивается сумма очков. Побеждает тот, у кого их больше
          (таблица показывается всем).
        </p>
      </Section>
    </>
  );
}

function NeverHaveIEverRules() {
  return (
    <>
      <Section title="О чём игра">
        <p>
          Классическая вечериночная игра: звучит утверждение в форме{' '}
          <strong className="text-slate-100">«Я никогда не…»</strong>. У каждого
          на телефоне — два варианта: <strong className="text-red-300">было</strong>{' '}
          (<strong className="text-slate-100">+1 очко</strong>) или{' '}
          <strong className="text-emerald-300">не было</strong>. Ответы не показываются
          друг другу до итога раунда.
        </p>
      </Section>
      <Section title="Как ведётся партия">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Одновременно на <strong className="text-slate-100">общем экране</strong> и на
            телефонах появляется формулировка — <strong className="text-slate-100">сразу
            открывается голосование</strong>, таймера нет, обсуждать можно устно.
          </li>
          <li>
            Когда все ответят, на витрине появятся аватары тех, кто выбрал «Было».
          </li>
          <li>
            <strong className="text-slate-100">«Следующий вопрос»</strong> нажимает только
            ведущий (экран комнаты или телефон создателя) — новая карточка и снова голосование.
            На ТВ для зрителей кнопок нет.{' '}
            <strong className="text-slate-100">«Завершить игру»</strong> у ведущего доступна
            всегда; в конце показывается общий счёт.
          </li>
        </ol>
      </Section>
    </>
  );
}

function CodenamesRules() {
  return (
    <>
      <Section title="О чём игра">
        <p>
          Две команды — <strong className="text-red-300">красные</strong> и{' '}
          <strong className="text-blue-300">синие</strong> — соревнуются, кто первым
          откроет все свои слова на общем поле. Под каждым словом скрыт цвет: карта
          вашей команды, соперника, нейтральная или опасная карта «убийца».
          Оперативники видят только слова; капитан видит, какой цвет под каким словом.
        </p>
      </Section>
      <Section title="Подсказка капитана: одно слово и число">
        <p>
          В ход своей команды капитан придумывает{' '}
          <strong className="text-slate-100">одну ассоциацию — одно слово</strong>, которое
          как-то связывает несколько карточек <strong className="text-slate-100">цвета
          его команды</strong> на поле, и называет <strong className="text-slate-100">число</strong>{' '}
          — сколько таких карточек он имеет в виду.
        </p>
        <p>
          Число может быть любым: <strong className="text-slate-100">хоть 1</strong> (если
          подсказка относится к одному слову), хоть 2, 3 и т.д. — главное, чтобы слово
          не было написано ни на одной из карточек поля.
        </p>
        <p className="rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-slate-200">
          <span className="text-slate-500 text-xs uppercase tracking-wide">Пример</span>
          <br />
          Капитан говорит: «<strong className="text-emerald-200">Море, 2</strong>». Команда
          понимает, что речь, например, о словах <strong className="text-slate-100">вода</strong> и{' '}
          <strong className="text-slate-100">корабль</strong> — если оба действительно вашего
          цвета, это удачная подсказка. Сначала все обсуждают устно, к каким клеткам это
          относится, и <strong className="text-slate-100">только после этого</strong> капитан
          на основе договорённости открывает на поле выбранные карточки — не наоборот.
        </p>
        <p className="text-slate-500 text-xs">
          В приложении подсказку обычно озвучивают вслух за столом; на экране капитан затем
          открывает клетки (второе нажатие по карточке подтверждает открытие). Оперативники
          могут ставить голос на карточку как дополнительную подсказку капитану.
        </p>
      </Section>
      <Section title="Роли">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-slate-100">Капитан</strong> знает цвета всех клеток,
            даёт слово+число и после обсуждения с командой открывает карточки на телефоне.
          </li>
          <li>
            <strong className="text-slate-100">Оперативник</strong> видит только слова.
            Участвует в обсуждении подсказки; в свой ход может отметить голосом карточку,
            за которую «больше голосов» в команде.
          </li>
          <li>
            <strong className="text-slate-100">Ведущий комнаты</strong> на телефоне перед
            игрой назначает капитанов и запускает партию. На ТВ или втором устройстве
            удобно открыть комнату как зрителю — видно цвета и голоса.
          </li>
        </ul>
      </Section>
      <Section title="Поле">
        <p>
          Сетка <strong className="text-slate-100">5×5</strong> — двадцать пять слов.
          Перед стартом случайно раздаются роли: сколько клеток красных, сколько синих,
          нейтральных и одна карта <strong className="text-slate-100">убийцы</strong>.
          Кто начинает — тоже выбирается случайно (у этой команды на одну свою карту
          больше).
        </p>
      </Section>
      <Section title="Ход по шагам">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Ходят по очереди красные и синие.</li>
          <li>
            Капитан ходящей команды произносит <strong className="text-slate-100">одно
            слово-подсказку и число</strong>.
          </li>
          <li>
            Команда обсуждает, какие клетки имеются в виду.{' '}
            <strong className="text-slate-100">После</strong> договорённости капитан открывает
            на поле выбранные слова (можно завершить ход раньше, если команда не уверена).
          </li>
          <li>
            Если капитан открыл карту <strong className="text-slate-100">чужого цвета или
            нейтральную</strong> — ход переходит к другой команде. В классической настолке
            иногда разрешают одну лишнюю попытку сверх названного числа — можно заранее
            договориться, играете ли вы с этим правилом.
          </li>
        </ol>
      </Section>
      <Section title="Победа и поражение">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Побеждает команда, у которой <strong className="text-slate-100">раньше
            открыты все карточки своего цвета</strong>.
          </li>
          <li>
            Если открыли карту <strong className="text-slate-100">убийцы</strong> в свой
            ход — <strong className="text-slate-100">проигрывает ваша команда</strong>,
            побеждает соперник.
          </li>
          <li>
            Если капитан открыл <strong className="text-slate-100">чужую или нейтральную</strong>{' '}
            карточку — ход переходит к другой команде.
          </li>
        </ul>
      </Section>
      <Section title="Счёт за вечер">
        <p>
          После каждой партии победителям начисляется очко в общий счёт сессии — можно
          играть несколько раз подряд в одной комнате и сравнивать результаты за вечер.
        </p>
      </Section>
    </>
  );
}

/**
 * @param {{
 *   rulesGame: 'common_guess' | 'codenames' | 'never_have_i_ever' | null;
 *   onClose: () => void;
 * }} props
 */
export default function GameRulesModal({ rulesGame, onClose }) {
  const [present, setPresent] = useState(false);
  const [displayType, setDisplayType] = useState(
    /** @type {'common_guess' | 'codenames' | 'never_have_i_ever' | null} */ (
      null
    ),
  );

  useEffect(() => {
    if (rulesGame) {
      setDisplayType(rulesGame);
      setPresent(true);
    }
  }, [rulesGame]);

  const active = displayType;

  const title =
    active === 'common_guess'
      ? 'Как играть: Угадай общее'
      : active === 'codenames'
        ? 'Как играть: Кодовые имена'
        : active === 'never_have_i_ever'
          ? 'Как играть: Я никогда не'
          : 'Правила';

  const accent =
    active === 'common_guess'
      ? 'border-fuchsia-500/40'
      : active === 'codenames'
        ? 'border-emerald-500/40'
        : active === 'never_have_i_ever'
          ? 'border-rose-500/40'
          : 'border-slate-700';

  function handleClose() {
    setPresent(false);
  }

  return (
    <AnimatePresence
      onExitComplete={() => {
        setDisplayType(null);
        onClose();
      }}
    >
      {present && active && (
        <motion.div
          key={active}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-rules-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={`relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-2xl border bg-slate-900 shadow-2xl ${accent}`}
          >
            <div className="shrink-0 border-b border-slate-800 px-5 py-4 sm:px-6">
              <h2
                id="game-rules-title"
                className="text-lg font-bold text-white pr-8 sm:text-xl"
              >
                {title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Коротко для тех, кто ни разу не играл в эту игру вживую.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
              {active === 'common_guess' ? (
                <CommonGuessRules />
              ) : active === 'codenames' ? (
                <CodenamesRules />
              ) : (
                <NeverHaveIEverRules />
              )}
            </div>
            <div className="shrink-0 border-t border-slate-800 p-4 sm:px-6">
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-xl bg-slate-700 hover:bg-slate-600 py-3 text-sm font-semibold text-white"
              >
                Понятно, закрыть
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
