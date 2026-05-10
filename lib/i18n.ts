export type Lang = 'ru' | 'zh';

export const dictionary = {
  ru: {
    language: 'Русский',
    clientHeadline: 'Китайская платформа отслеживания логистики экспорта автомобилей',
    clientSubline: 'Надёжное отслеживание маршрута, статуса, ETA, фото и комментариев по доставке автомобиля.',
    searchPlaceholder: 'Введите VIN или ID отслеживания AT-000001',
    searchButton: 'Отследить',
    notFoundCar: 'Автомобиль с таким VIN или номером отслеживания не найден',
    notFoundDelivery: 'Доставка для этого автомобиля не найдена',
    emptySearch: 'Введите VIN или номер отслеживания',
    tracker: 'Трекер',
    adminPanel: 'Панель управления',
    deliveries: 'Доставки',
    cars: 'Автомобили',
    routes: 'Маршруты',
    users: 'Пользователи',
    logs: 'Логи',
    login: 'Войти',
    logout: 'Выйти',
    statusInProgress: 'В пути',
    statusPaused: 'На паузе',
    statusDelivered: 'Доставлено',
    eta: 'Расчётная дата прибытия',
    progress: 'Прогресс',
    map: 'Карта',
    photos: 'Фото',
    history: 'История',
    save: 'Сохранить',
    cancel: 'Отмена',
    create: 'Создать',
    delete: 'Удалить',
    edit: 'Изменить',
    confirmDeleteCar: 'Подтвердите удаление автомобиля',
    confirmDeleteRoute: 'Подтвердите удаление маршрута',
  },
  zh: {
    language: '中文',
    clientHeadline: '中国汽车出口物流追踪平台',
    clientSubline: '可靠追踪车辆运输路线、状态、预计到达时间、照片与备注。',
    searchPlaceholder: '输入 VIN 或追踪 ID AT-000001',
    searchButton: '查询',
    notFoundCar: '未找到该 VIN 或追踪编号的车辆',
    notFoundDelivery: '未找到该车辆的运输订单',
    emptySearch: '请输入 VIN 或追踪编号',
    tracker: '订单追踪',
    adminPanel: '管理面板',
    deliveries: '运输订单',
    cars: '车辆',
    routes: '路线',
    users: '用户',
    logs: '日志',
    login: '登录',
    logout: '退出',
    statusInProgress: '运输中',
    statusPaused: '已暂停',
    statusDelivered: '已交付',
    eta: '预计到达时间',
    progress: '进度',
    map: '地图',
    photos: '照片',
    history: '历史',
    save: '保存',
    cancel: '取消',
    create: '创建',
    delete: '删除',
    edit: '编辑',
    confirmDeleteCar: '请确认删除车辆',
    confirmDeleteRoute: '请确认删除路线',
  },
} as const;

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'ru';
  const saved = localStorage.getItem('autottc_lang');
  return saved === 'zh' ? 'zh' : 'ru';
}

export function setLang(next: Lang) {
  if (typeof window !== 'undefined') localStorage.setItem('autottc_lang', next);
}

export function t(lang: Lang, key: keyof typeof dictionary.ru) {
  return dictionary[lang][key] || dictionary.ru[key] || String(key);
}
