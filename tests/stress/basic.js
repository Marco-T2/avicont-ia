import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/`);

  check(res, {
    'status es 200': (r) => r.status === 200,
    'tiempo de respuesta < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
