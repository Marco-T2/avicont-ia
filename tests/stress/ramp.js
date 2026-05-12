import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.10'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    'home: status 200': (r) => r.status === 200,
  });

  sleep(0.5);

  const signinRes = http.get(`${BASE_URL}/sign-in`);
  check(signinRes, {
    'sign-in: status 200': (r) => r.status === 200,
  });

  sleep(1);
}
