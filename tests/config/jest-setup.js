jest.setTimeout(10000);
jest.spyOn(global.console, 'log').mockImplementation(() => jest.fn());
jest.spyOn(global.console, 'debug').mockImplementation(() => jest.fn());
