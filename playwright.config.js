import {defineConfig} from '@playwright/test';

const phone=(name,width,height,browserName='chromium')=>({name,use:{browserName,viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1}});
export default defineConfig({
  testDir:'./e2e',
  testMatch:'**/*.spec.js',
  fullyParallel:true,
  forbidOnly:!!process.env.CI,
  retries:0,
  workers:2,
  timeout:30000,
  expect:{timeout:5000},
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:48179',trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
  webServer:{command:'node scripts/serve-e2e.mjs',url:'http://127.0.0.1:48179',reuseExistingServer:false,timeout:15000},
  projects:[
    phone('android-small',360,800),
    phone('phone-standard',390,844),
    phone('phone-large',430,932),
    phone('iphone-webkit',390,844,'webkit'),
    {name:'tablet',use:{browserName:'chromium',viewport:{width:768,height:1024},hasTouch:true}},
    {name:'laptop',use:{browserName:'chromium',viewport:{width:1366,height:768}}},
    {name:'desktop',use:{browserName:'chromium',viewport:{width:1920,height:1080}}}
  ]
});
