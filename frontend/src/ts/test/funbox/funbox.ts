import * as Notifications from "../../elements/notifications";
import * as Misc from "../../utils/misc";
import * as ManualRestart from "../manual-restart-tracker";
import Config, * as UpdateConfig from "../../config";
import * as MemoryTimer from "./memory-funbox-timer";
import * as FunboxMemory from "./funbox-memory";
import * as FunboxList from "./funbox-list";
import { save } from "./funbox-memory";
import * as TTSEvent from "../../observables/tts-event";
import * as KeymapEvent from "../../observables/keymap-event";
import * as TestWords from "../test-words";
import * as TestInput from "../test-input";
import * as WeakSpot from "../weak-spot";
import { getPoem } from "../poetry";
import { getSection } from "../wikipedia";
import * as IPGenerator from "../ip-addresses";
import {
  areFunboxesCompatible,
  checkFunboxForcedConfigs,
} from "./funbox-validation";
import { Wordset } from "../wordset";
import * as LayoutfluidFunboxTimer from "./layoutfluid-funbox-timer";

const prefixSize = 2;

class CharDistribution {
  public chars: { [char: string]: number };
  public count: number;
  constructor() {
    this.chars = {};
    this.count = 0;
  }

  public addChar(char: string): void {
    this.count++;
    if (char in this.chars) {
      this.chars[char]++;
    } else {
      this.chars[char] = 1;
    }
  }

  public randomChar(): string {
    const randomIndex = Misc.randomIntFromRange(0, this.count - 1);
    let runningCount = 0;
    for (const [char, charCount] of Object.entries(this.chars)) {
      runningCount += charCount;
      if (runningCount > randomIndex) {
        return char;
      }
    }

    return Object.keys(this.chars)[0];
  }
}

class PseudolangWordGenerator extends Wordset {
  public ngrams: { [prefix: string]: CharDistribution } = {};
  constructor(words: string[]) {
    super(words);
    // Can generate an unbounded number of words in theory.
    this.length = Infinity;

    for (let word of words) {
      // Mark the end of each word with a space.
      word += " ";
      let prefix = "";
      for (const c of word) {
        // Add `c` to the distribution of chars that can come after `prefix`.
        if (!(prefix in this.ngrams)) {
          this.ngrams[prefix] = new CharDistribution();
        }
        this.ngrams[prefix].addChar(c);
        prefix = (prefix + c).substr(-prefixSize);
      }
    }
  }

  public override randomWord(): string {
    let word = "";
    for (;;) {
      const prefix = word.substr(-prefixSize);
      const charDistribution = this.ngrams[prefix];
      if (!charDistribution) {
        // This shouldn't happen if this.ngrams is complete. If it does
        // somehow, start generating a new word.
        word = "";
        continue;
      }
      // Pick a random char from the distribution that comes after `prefix`.
      const nextChar = charDistribution.randomChar();
      if (nextChar === " ") {
        // A space marks the end of the word, so stop generating and return.
        break;
      }
      word += nextChar;
    }
    return word;
  }
}

FunboxList.setFunboxFunctions("simon_says", {
  applyConfig(): void {
    UpdateConfig.setKeymapMode("next", true);
  },
  rememberSettings(): void {
    save("keymapMode", Config.keymapMode, UpdateConfig.setKeymapMode);
  },
});

FunboxList.setFunboxFunctions("tts", {
  applyConfig(): void {
    UpdateConfig.setKeymapMode("off", true);
  },
  rememberSettings(): void {
    save("keymapMode", Config.keymapMode, UpdateConfig.setKeymapMode);
  },
  toggleScript(params: string[]): void {
    if (window.speechSynthesis === undefined) {
      Notifications.add("Failed to load text-to-speech script", -1);
      return;
    }
    TTSEvent.dispatch(params[0]);
  },
});

FunboxList.setFunboxFunctions("arrows", {
  getWord(_wordset, wordIndex): string {
    return Misc.chart2Word(wordIndex === 0);
  },
  rememberSettings(): void {
    save("highlightMode", Config.highlightMode, UpdateConfig.setHighlightMode);
  },
  handleChar(char: string): string {
    if (char === "a" || char === "ArrowLeft" || char === "j") {
      return "←";
    }
    if (char === "s" || char === "ArrowDown" || char === "k") {
      return "↓";
    }
    if (char === "w" || char === "ArrowUp" || char === "i") {
      return "↑";
    }
    if (char === "d" || char === "ArrowRight" || char === "l") {
      return "→";
    }
    return char;
  },
  isCharCorrect(char: string, originalChar: string): boolean {
    if (
      (char === "a" || char === "ArrowLeft" || char === "j") &&
      originalChar === "←"
    ) {
      return true;
    }
    if (
      (char === "s" || char === "ArrowDown" || char === "k") &&
      originalChar === "↓"
    ) {
      return true;
    }
    if (
      (char === "w" || char === "ArrowUp" || char === "i") &&
      originalChar === "↑"
    ) {
      return true;
    }
    if (
      (char === "d" || char === "ArrowRight" || char === "l") &&
      originalChar === "→"
    ) {
      return true;
    }
    return false;
  },
  async preventDefaultEvent(
    event: JQuery.KeyDownEvent<Document, null, Document, Document>
  ): Promise<boolean> {
    return ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(
      event.key
    );
  },
  getWordHtml(char: string, letterTag?: boolean): string {
    let retval = "";
    if (char === "↑") {
      if (letterTag) retval += `<letter>`;
      retval += `<i class="fas fa-arrow-up"></i>`;
      if (letterTag) retval += `</letter>`;
    }
    if (char === "↓") {
      if (letterTag) retval += `<letter>`;
      retval += `<i class="fas fa-arrow-down"></i>`;
      if (letterTag) retval += `</letter>`;
    }
    if (char === "←") {
      if (letterTag) retval += `<letter>`;
      retval += `<i class="fas fa-arrow-left"></i>`;
      if (letterTag) retval += `</letter>`;
    }
    if (char === "→") {
      if (letterTag) retval += `<letter>`;
      retval += `<i class="fas fa-arrow-right"></i>`;
      if (letterTag) retval += `</letter>`;
    }
    return retval;
  },
});

FunboxList.setFunboxFunctions("rAnDoMcAsE", {
  alterText(word: string): string {
    let randomcaseword = word[0];
    for (let i = 1; i < word.length; i++) {
      if (randomcaseword[i - 1] === randomcaseword[i - 1].toUpperCase()) {
        randomcaseword += word[i].toLowerCase();
      } else {
        randomcaseword += word[i].toUpperCase();
      }
    }
    return randomcaseword;
  },
});

FunboxList.setFunboxFunctions("capitals", {
  alterText(word: string): string {
    return Misc.capitalizeFirstLetterOfEachWord(word);
  },
});

FunboxList.setFunboxFunctions("layoutfluid", {
  applyConfig(): void {
    UpdateConfig.setLayout(
      Config.customLayoutfluid.split("#")[0]
        ? Config.customLayoutfluid.split("#")[0]
        : "qwerty",
      true
    );
    UpdateConfig.setKeymapLayout(
      Config.customLayoutfluid.split("#")[0]
        ? Config.customLayoutfluid.split("#")[0]
        : "qwerty",
      true
    );
  },
  rememberSettings(): void {
    save("keymapMode", Config.keymapMode, UpdateConfig.setKeymapMode);
    save("layout", Config.layout, UpdateConfig.setLayout);
    save("keymapLayout", Config.keymapLayout, UpdateConfig.setKeymapLayout);
  },
  handleSpace(): void {
    if (Config.mode !== "time") {
      // here I need to check if Config.customLayoutFluid exists because of my
      // scuffed solution of returning whenever value is undefined in the setCustomLayoutfluid function
      const layouts: string[] = Config.customLayoutfluid
        ? Config.customLayoutfluid.split("#")
        : ["qwerty", "dvorak", "colemak"];
      const outOf: number = TestWords.words.length;
      const wordsPerLayout = Math.floor(outOf / layouts.length);
      const index = Math.floor(
        (TestInput.input.history.length + 1) / wordsPerLayout
      );
      const mod =
        wordsPerLayout - ((TestWords.words.currentIndex + 1) % wordsPerLayout);

      console.log(wordsPerLayout);
      console.log(mod);

      if (layouts[index + 1]) {
        if (mod <= 3) {
          LayoutfluidFunboxTimer.show();
          LayoutfluidFunboxTimer.updateWords(mod, layouts[index + 1]);
        }
        if (mod === wordsPerLayout) {
          UpdateConfig.setLayout(layouts[index]);
          UpdateConfig.setKeymapLayout(layouts[index]);
          if (mod > 3) {
            LayoutfluidFunboxTimer.hide();
          }
        }
      } else {
        LayoutfluidFunboxTimer.hide();
      }
      setTimeout(() => {
        KeymapEvent.highlight(
          TestWords.words
            .getCurrent()
            .charAt(TestInput.input.current.length)
            .toString()
        );
      }, 1);
    }
  },
  getResultContent(): string {
    return Config.customLayoutfluid.replace(/#/g, " ");
  },
  restart(): void {
    if (this.applyConfig) this.applyConfig();
    setTimeout(() => {
      KeymapEvent.highlight(
        TestWords.words
          .getCurrent()
          .substring(
            TestInput.input.current.length,
            TestInput.input.current.length + 1
          )
          .toString()
      );
    }, 1);
  },
});

FunboxList.setFunboxFunctions("gibberish", {
  getWord(): string {
    return Misc.getGibberish();
  },
});

FunboxList.setFunboxFunctions("58008", {
  getWord(): string {
    let num = Misc.getNumbers(7);
    if (Config.language.startsWith("kurdish")) {
      num = Misc.convertNumberToArabic(num);
    } else if (Config.language.startsWith("nepali")) {
      num = Misc.convertNumberToNepali(num);
    }
    return num;
  },
  punctuateWord(word: string): string {
    if (word.length > 3) {
      if (Math.random() < 0.5) {
        word = Misc.setCharAt(
          word,
          Misc.randomIntFromRange(1, word.length - 2),
          "."
        );
      }
      if (Math.random() < 0.75) {
        const index = Misc.randomIntFromRange(1, word.length - 2);
        if (
          word[index - 1] !== "." &&
          word[index + 1] !== "." &&
          word[index + 1] !== "0"
        ) {
          const special = Misc.randomElementFromArray(["/", "*", "-", "+"]);
          word = Misc.setCharAt(word, index, special);
        }
      }
    }
    return word;
  },
  rememberSettings(): void {
    save("numbers", Config.numbers, UpdateConfig.setNumbers);
  },
  handleChar(char: string): string {
    if (char === "\n") {
      return " ";
    }
    return char;
  },
});

FunboxList.setFunboxFunctions("ascii", {
  getWord(): string {
    return Misc.getASCII();
  },
  punctuateWord(word: string): string {
    return word;
  },
});

FunboxList.setFunboxFunctions("specials", {
  getWord(): string {
    return Misc.getSpecials();
  },
});

FunboxList.setFunboxFunctions("read_ahead_easy", {
  rememberSettings(): void {
    save("highlightMode", Config.highlightMode, UpdateConfig.setHighlightMode);
  },
});

FunboxList.setFunboxFunctions("read_ahead", {
  rememberSettings(): void {
    save("highlightMode", Config.highlightMode, UpdateConfig.setHighlightMode);
  },
});

FunboxList.setFunboxFunctions("read_ahead_hard", {
  rememberSettings(): void {
    save("highlightMode", Config.highlightMode, UpdateConfig.setHighlightMode);
  },
});

FunboxList.setFunboxFunctions("memory", {
  applyConfig(): void {
    $("#wordsWrapper").addClass("hidden");
    UpdateConfig.setShowAllLines(true, true);
    if (Config.keymapMode === "next") {
      UpdateConfig.setKeymapMode("react", true);
    }
  },
  rememberSettings(): void {
    save("mode", Config.mode, UpdateConfig.setMode);
    save("showAllLines", Config.showAllLines, UpdateConfig.setShowAllLines);
    if (Config.keymapMode === "next") {
      save("keymapMode", Config.keymapMode, UpdateConfig.setKeymapMode);
    }
  },
  start(): void {
    MemoryTimer.reset();
    $("#wordsWrapper").addClass("hidden");
  },
  restart(): void {
    MemoryTimer.start();
    if (Config.keymapMode === "next") {
      UpdateConfig.setKeymapMode("react");
    }
  },
});

FunboxList.setFunboxFunctions("nospace", {
  rememberSettings(): void {
    save("highlightMode", Config.highlightMode, UpdateConfig.setHighlightMode);
  },
});

FunboxList.setFunboxFunctions("poetry", {
  async pullSection(): Promise<Misc.Section | false> {
    return getPoem();
  },
});

FunboxList.setFunboxFunctions("wikipedia", {
  async pullSection(lang?: string): Promise<Misc.Section | false> {
    return getSection(lang ? lang : "english");
  },
});

FunboxList.setFunboxFunctions("weakspot", {
  getWord(wordset?: Wordset): string {
    if (wordset !== undefined) return WeakSpot.getWord(wordset);
    else return "";
  },
});

FunboxList.setFunboxFunctions("pseudolang", {
  async withWords(words?: string[]): Promise<Wordset> {
    if (words !== undefined) return new PseudolangWordGenerator(words);
    return new Wordset([]);
  },
});

FunboxList.setFunboxFunctions("IPv4", {
  getWord(): string {
    return IPGenerator.getRandomIPv4address();
  },
  punctuateWord(word: string): string {
    let w = word;
    if (Math.random() < 0.25) {
      w = IPGenerator.addressToCIDR(word);
    }
    return w;
  },
  rememberSettings(): void {
    save("numbers", Config.numbers, UpdateConfig.setNumbers);
  },
});

FunboxList.setFunboxFunctions("IPv6", {
  getWord(): string {
    return IPGenerator.getRandomIPv6address();
  },
  punctuateWord(word: string): string {
    let w = word;
    if (Math.random() < 0.25) {
      w = IPGenerator.addressToCIDR(word);
    }
    // Compress
    if (w.includes(":")) {
      w = w
        .replace(/\b(?:0+:){2,}/, "::")
        .split(":")
        .map((a) => a.replace(/\b0+/g, ""))
        .join(":");
    }
    return w;
  },
  rememberSettings(): void {
    save("numbers", Config.numbers, UpdateConfig.setNumbers);
  },
});

FunboxList.setFunboxFunctions("binary", {
  getWord(): string {
    return Misc.getBinary();
  },
});

FunboxList.setFunboxFunctions("zipf", {
  getWordsFrequencyMode(): MonkeyTypes.FunboxWordsFrequency {
    return "zipf";
  },
});

export function toggleScript(...params: string[]): void {
  FunboxList.get(Config.funbox).forEach((funbox) => {
    if (funbox.functions?.toggleScript) funbox.functions.toggleScript(params);
  });
}

export function setFunbox(funbox: string): boolean {
  if (funbox === "none") {
    FunboxList.get(Config.funbox).forEach((f) => f.functions?.clearGlobal?.());
  }
  FunboxMemory.load();
  UpdateConfig.setFunbox(funbox, false);
  return true;
}

export function toggleFunbox(funbox: string): boolean {
  if (funbox === "none") setFunbox("none");
  if (
    !areFunboxesCompatible(Config.funbox, funbox) &&
    !Config.funbox.split("#").includes(funbox)
  ) {
    Notifications.add(
      `${Misc.capitalizeFirstLetter(
        funbox.replace(/_/g, " ")
      )} funbox is not compatible with the current funbox selection`,
      0
    );
    return true;
  }
  FunboxMemory.load();
  const e = UpdateConfig.toggleFunbox(funbox, false);

  if (!Config.funbox.includes(funbox)) {
    FunboxList.get(funbox).forEach((f) => f.functions?.clearGlobal?.());
  } else {
    FunboxList.get(funbox).forEach((f) => f.functions?.applyGlobalCSS?.());
  }

  //todo find out what the hell this means
  if (e === false || e === true) return false;
  return true;
}

export async function clear(): Promise<boolean> {
  $("body").attr(
    "class",
    $("body")
      ?.attr("class")
      ?.split(/\s+/)
      ?.filter((it) => !it.startsWith("fb-"))
      ?.join(" ") || ""
  );

  $("#funBoxTheme").removeAttr("href");

  $("#wordsWrapper").removeClass("hidden");
  MemoryTimer.reset();
  ManualRestart.set();
  return true;
}

export async function activate(funbox?: string): Promise<boolean | undefined> {
  if (funbox === undefined || funbox === null) {
    funbox = Config.funbox;
  } else if (Config.funbox !== funbox) {
    Config.funbox = funbox;
  }

  // The configuration might be edited with dev tools,
  // so we need to double check its validity
  if (!areFunboxesCompatible(Config.funbox)) {
    Notifications.add(
      Misc.createErrorMessage(
        undefined,
        `Failed to activate funbox: funboxes ${Config.funbox.replace(
          /_/g,
          " "
        )} are not compatible`
      ),
      -1
    );
    UpdateConfig.setFunbox("none", true);
    await clear();
    return false;
  }

  MemoryTimer.reset();
  await setFunboxBodyClasses();
  await applyFunboxCSS();

  $("#wordsWrapper").removeClass("hidden");

  let language;
  try {
    language = await Misc.getCurrentLanguage(Config.language);
  } catch (e) {
    Notifications.add(
      Misc.createErrorMessage(e, "Failed to activate funbox"),
      -1
    );
    UpdateConfig.setFunbox("none", true);
    await clear();
    return false;
  }

  if (language.ligatures) {
    if (
      FunboxList.get(Config.funbox).find((f) =>
        f.properties?.includes("noLigatures")
      )
    ) {
      Notifications.add(
        "Current language does not support this funbox mode",
        0
      );
      UpdateConfig.setFunbox("none", true);
      await clear();
      return;
    }
  }

  let canSetSoFar = true;

  for (const [configKey, configValue] of Object.entries(Config)) {
    const check = checkFunboxForcedConfigs(
      configKey,
      configValue,
      Config.funbox
    );
    if (check.result === true) continue;
    if (check.result === false) {
      if (check.forcedConfigs && check.forcedConfigs.length > 0) {
        if (configKey === "mode") {
          UpdateConfig.setMode(check.forcedConfigs[0] as MonkeyTypes.Mode);
        }
        if (configKey === "words") {
          UpdateConfig.setWordCount(check.forcedConfigs[0] as number);
        }
        if (configKey === "time") {
          UpdateConfig.setTimeConfig(check.forcedConfigs[0] as number);
        }
        if (configKey === "punctuation") {
          UpdateConfig.setPunctuation(check.forcedConfigs[0] as boolean);
        }
        if (configKey === "numbers") {
          UpdateConfig.setNumbers(check.forcedConfigs[0] as boolean);
        }
        if (configKey === "highlightMode") {
          UpdateConfig.setHighlightMode(
            check.forcedConfigs[0] as MonkeyTypes.HighlightMode
          );
        }
      } else {
        canSetSoFar = false;
        break;
      }
    }
  }

  if (!canSetSoFar) {
    if (Config.funbox.includes("#")) {
      Notifications.add(
        `Failed to activate funboxes ${Config.funbox}: no intersecting forced configs. Disabling funbox`,
        -1
      );
    } else {
      Notifications.add(
        `Failed to activate funbox ${Config.funbox}: no forced configs. Disabling funbox`,
        -1
      );
    }
    UpdateConfig.setFunbox("none", true);
    await clear();
    return;
  }

  ManualRestart.set();
  FunboxList.get(Config.funbox).forEach(async (funbox) => {
    funbox.functions?.applyConfig?.();
  });
  // ModesNotice.update();
  return true;
}

export async function rememberSettings(): Promise<void> {
  FunboxList.get(Config.funbox).forEach(async (funbox) => {
    if (funbox.functions?.rememberSettings) funbox.functions.rememberSettings();
  });
}

FunboxList.setFunboxFunctions("morse", {
  alterText(word: string): string {
    return Misc.convertToMorse(word);
  },
});

FunboxList.setFunboxFunctions("crt", {
  applyGlobalCSS(): void {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      //Workaround for bug https://bugs.webkit.org/show_bug.cgi?id=256171 in Safari 16.5 or earlier
      const versionMatch = navigator.userAgent.match(
        /.*Version\/([0-9]*)\.([0-9]*).*/
      );
      const mainVersion = versionMatch !== null ? parseInt(versionMatch[1]) : 0;
      const minorVersion =
        versionMatch !== null ? parseInt(versionMatch[2]) : 0;
      if (mainVersion <= 16 && minorVersion <= 5) {
        Notifications.add(
          "CRT is not available on Safari 16.5 or earlier.",
          0,
          {
            duration: 5,
          }
        );
        toggleFunbox("crt");
        return;
      }
    }
    $("body").append('<div id="scanline" />');
    $("body").addClass("crtmode");
    $("#globalFunBoxTheme").attr("href", `funbox/crt.css`);
  },
  clearGlobal(): void {
    $("#scanline").remove();
    $("body").removeClass("crtmode");
    $("#globalFunBoxTheme").attr("href", ``);
  },
});

async function setFunboxBodyClasses(): Promise<boolean> {
  const $body = $("body");

  const activeFbClasses = FunboxList.get(Config.funbox).map(
    (it) => "fb-" + it.name.replaceAll("_", "-")
  );

  const currentClasses =
    $body
      ?.attr("class")
      ?.split(/\s+/)
      ?.filter((it) => !it.startsWith("fb-")) || [];

  $body.attr("class", [...currentClasses, ...activeFbClasses].join(" "));

  return true;
}

async function applyFunboxCSS(): Promise<boolean> {
  const $theme = $("#funBoxTheme");

  //currently we only support one active funbox with hasCSS
  const activeFunboxWithTheme = FunboxList.get(Config.funbox).find(
    (it) => it.hasCSS == true
  );

  const activeTheme =
    activeFunboxWithTheme != null
      ? "funbox/" + activeFunboxWithTheme.name + ".css"
      : "";

  const currentTheme = $theme.attr("href") || null;

  if (activeTheme != currentTheme) {
    $theme.attr("href", activeTheme);
  }

  return true;
}
