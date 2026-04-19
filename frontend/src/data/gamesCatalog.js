/**
 * Карточки каталога игр (главная страница, лобби комнаты).
 * playable + gameType — можно запустить из комнаты; иначе заглушка «скоро».
 */
export const LOBBY_GAME_CARDS = [
  {
    id: 'common_guess',
    title: 'Угадай общее',
    description:
      'Пишите ассоциации к разным (иногда безумным!) темам и ищите совпадения с друзьями! Чем больше совпадений — тем ближе победа!',
    image: '/games/common-guess.svg',
    gameType: 'common_guess',
    playable: true,
  },
  {
    id: 'codenames',
    title: 'Кодовые имена',
    description:
      'Две команды, слова на поле и один убийца. Капитаны дают подсказки, оперативники голосуют за карточки — открывайте слова осторожно!',
    image: '/games/codenames.svg',
    gameType: 'codenames',
    playable: true,
  },
  {
    id: 'more_soon',
    title: 'Новые игры — скоро',
    description:
      'Готовим ещё режимы для компании: следите за обновлениями.',
    image: '/games/more-soon.svg',
    gameType: null,
    playable: false,
  },
];
