/* 写字・見写し専用問題データ。ほかのジャンルから独立して編集できます。 */
(function (root) {
  'use strict';
  var words = [
    '山','川','水','木','花','空','雨','手','足','人','日','月','本','田','口','目','耳','火','犬','猫',
    '家','道','駅','鍵','靴','傘','魚','鳥','星','朝','夜','春','夏','秋','冬',
    '学校','病院','電話','時計','名前','食事','財布','電車','自転車','机','図書館',
    'いぬ','ねこ','みず','そら','はな','かさ','くつ','りんご','さくら','おはよう',
    'バス','パン','コップ','ノート','カメラ','トマト','テレビ'
  ];
  root.KotobaCopyQuestionBank = {
    version: 2,
    words: words.slice(),
    makeQuestions: function () {
      return words.map(function (word, index) {
        return {kind: 'handwriting', question: '見本と同じ文字を1文字ずつ書き写し、認識された候補から文字を選んで回答してください。',
          prompt: word, answer: word, hint: '一文字ずつ、形と順番に注目して書きましょう。', itemNo: index + 1};
      });
    }
  };
})(window);
