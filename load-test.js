import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '2m', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = 'https://clickboucher-production.up.railway.app';

export default function () {
  let res = http.get(`${BASE_URL}/decouvrir`);
  check(res, { 'decouvrir OK': (r) => r.status === 200 });
  sleep(1);

  res = http.get(`${BASE_URL}/api/shops`);
  check(res, { 'api shops OK': (r) => r.status === 200 });
  sleep(1);

  res = http.get(`${BASE_URL}/api/shops/cmlrgihb40000330obmaf09bq`);
  check(res, { 'shop detail OK': (r) => r.status === 200 });
  sleep(1);

  res = http.get(`${BASE_URL}/api/health`);
  check(res, { 'health OK': (r) => r.status === 200 });
  sleep(2);
}
