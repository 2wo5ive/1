export type CityOption = {
  zh: string;
  en: string;
  ru: string;
  pinyin: string;
};

const RAW_CITIES = `北京/Beijing/Пекин
上海/Shanghai/Шанхай
天津/Tianjin/Тяньцзинь
重庆/Chongqing/Чунцин
广州/Guangzhou/Гуанчжоу
深圳/Shenzhen/Шэньчжэнь
成都/Chengdu/Чэнду
西安/Xi'an/Сиань
乌鲁木齐/Urumqi/Урумчи
霍尔果斯/Horgos/Хоргос
绥芬河/Suifenhe/Суйфэньхэ
Уссурийск/Ussuriysk/Уссурийск`;

function clean(v: string) {
  return v.trim().replace(/\s+/g, " ");
}

export const CITY_OPTIONS: CityOption[] = RAW_CITIES
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [zh = "", en = "", ru = ""] = line.split("/");
    return {
      zh: clean(zh),
      en: clean(en),
      ru: clean(ru),
      pinyin: clean(en), // вариант Б: обязательно
    };
  });

export const DESTINATION_CITY_EN = ["Horgos", "Suifenhe", "Ussuriysk"];
export const DESTINATION_CITY_ZH = ["霍尔果斯", "绥芬河", "Уссурийск"];
export const DESTINATION_CITY_RU = ["Хоргос", "Суйфэньхэ", "Уссурийск"];

export function cityLabel(c: CityOption) {
  return `${c.zh} / ${c.en} / ${c.ru}`;
}