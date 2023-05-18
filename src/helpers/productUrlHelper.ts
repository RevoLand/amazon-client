import { URL } from 'url';

export const getTldFromUrl = (urlToParse: string) => new URL(urlToParse).hostname.replace('www.', '').replace('amazon', '');
