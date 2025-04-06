// eslint-disable-next-line no-undef
const { DateTime, Duration, Interval } = luxon;

const sourceUrl = 'https://nhdes.rtiamanzi.org/api/plotly/';
const observedPoolElevationGuid = 'b375af3e-ec23-44f9-ab09-43ebe8c92a75';
const precipitationGuid = 'ce5ec3d5-0488-4f38-928c-4bedc708f599';
const islandPondGuid = '74ffcc4c-69c2-4f62-a79b-dc9935e074ba';
const highlandLakeGuid = '75b462e4-f239-4cf6-9ddf-94553ac5f26e'

const normal = {
  islandPond: 1281.63,
  highlandLake: 1294.6
};

const charts = [];

const qs = (selector) => document.querySelector(selector);

const fetchData = async (options) => {
  const response = await fetch(sourceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  });

  const data = await response.json();
  return data;
};

const loadData = async () => {
  const endTime = DateTime.now();
  const startTime = endTime.minus(Duration.fromObject({ days: 14 }));

  const options = {
    start_dt: startTime.toISO(),
    end_dt: endTime.toISO(),
    tzname: 'America/New_York'
  };

  const data = { elevation: {} };

  options.plot_id = observedPoolElevationGuid,
  options.feature_id = highlandLakeGuid;
  data.elevation.highlandLake = await fetchData(options);

  options.feature_id = islandPondGuid;
  data.elevation.islandPond = await fetchData(options);

  options.feature_id = highlandLakeGuid;
  options.plot_id = precipitationGuid;
  data.precipitation = await fetchData(options);

  return data;
};

const formatElevation = (value) => {
  let inches = Math.round(value * 12);

  const sign = inches > 0 ? '+' : inches < 0 ? '-' : '';
  inches = Math.abs(inches);

  if (inches <= 18) {
    return `${sign}${inches} in`;
  }

  const feet = Math.floor(inches / 12);
  inches = Math.round(inches - (feet * 12));
  return `${sign}${feet} ft ${inches} in`;
};

const formatTrend = (value) => {
  const inches = value * 12;
  let trend = 'falling';

  if (inches > 1) {
    trend = '<span class="important"><b>rising</b></span>';
  }
  else if (inches > 0.1) {
    trend = 'rising';
  }
  else if (inches > -0.1) {
    trend = 'steady';
  }

  return trend
};

const formatTime = (t) => {
  return `${t.weekdayShort} ${t.monthShort} ${t.day} ${t.toLocaleString(DateTime.TIME_SIMPLE)}`;
};

const formatPrecipitation = (value) => {
  return `${value.toFixed(1)} in`;
};

const showElevations = (data) => {
  if (charts.length) {
    charts.forEach((c) => c.destroy());
    charts.length = 0;
  };

  [ 'highlandLake', 'islandPond' ].forEach((lake) => {
    const elevation = data.elevation[lake].data[0].y.map((e) => e - normal[lake]);
    const time = data.elevation[lake].data[0].x.map((t) => DateTime.fromISO(t));
  
    const latestElevation = elevation.at(-1);
    const latestTime = time.at(-1);
    const trend = latestElevation - elevation.at(-2);

    let highElevation = -100;
    let highTime;
    let lowElevation = 100;
    let lowTime;
  
    for (let i = 0; i < elevation.length; i++) {
      if (elevation[i] > highElevation) {
        highElevation = elevation[i];
        highTime = time[i];
      }
  
      if (elevation[i] < lowElevation) {
        lowElevation = elevation[i];
        lowTime = time[i];
      }
    }
  
    const important = latestElevation >= 1 ? 'class="important"' : '';

    qs(`#${lake} .latestElevation`).innerHTML = `<span ${important}>${formatElevation(latestElevation)}</span>`;
    qs(`#${lake} .latestTime`).innerText = formatTime(latestTime);
    qs(`#${lake} .trend`).innerHTML = formatTrend(trend);
    qs(`#${lake} .highElevation`).innerText = formatElevation(highElevation);
    qs(`#${lake} .highTime`).innerText = formatTime(highTime);
    qs(`#${lake} .lowElevation`).innerText = formatElevation(lowElevation);
    qs(`#${lake} .lowTime`).innerText = formatTime(lowTime);

    const endTime = DateTime.now();
    const startTime = endTime.minus(Duration.fromObject({ days: 14 }));
  
    const chartOptions = {
      type: 'line',
      options: {
        animation: false,
        elements: {
          point: {
            radius: 0
          },
          line: {
            tension: 1,
          }
        },
        scales: {
          x: {
            type: 'time',
            min: startTime.valueOf(),
            max: endTime.valueOf(),
            display: false
          },
          y: {
            min: Math.min(-1, Math.floor(lowElevation)),
            max: Math.max(1, Math.ceil(highElevation)),
            title: {
              display: true,
              text: 'feet'
            },
            ticks : {
              beginAtZero : true
            } 
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (c) => {
                return formatTime(DateTime.fromMillis(c[0].raw.x));
              },
              label: (c) => formatElevation(c.raw.y)
            }
          }
        }
      },
      data: {
        datasets: [
          {
            data: elevation.map((e, i) => ({ x: time[i].valueOf(), y: e })),
            borderWidth: 2,
            borderColor: '#8080F0'
          },
          {
            data: [{ x: startTime.valueOf(), y: 0 }, { x: endTime.valueOf(), y: 0 }],
            borderWidth: 1,
            borderColor: '#606060'
          }
        ]
      },
      plugins: [
        {
          id: 'background',
          beforeDraw: (chart) => {
            const { ctx } = chart;
            ctx.save();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, chart.width, chart.height);
          }
        }
      ]
    };
    
    charts.push(new Chart(qs(`#${lake} .chart canvas`), chartOptions));
  });
};

const showPrecipitation = (data) => {
  const precipitation = data.precipitation.data[1].y;
  const time = data.precipitation.data[1].x;

  const lastTime = DateTime.fromISO(time.at(-1));

  const ms1 = 86400000;
  const ms2 = ms1 * 2;
  const ms7 = ms1 * 7;
  const ms14 = ms1 * 14;

  let sum1 = 0;
  let sum2 = 0;
  let sum7 = 0;
  let sum14 = 0;

  for (let i = 0; i < precipitation.length; i++) {
    const ms = Interval.fromDateTimes(DateTime.fromISO(time[i]), lastTime).length();

    if (ms <= ms14) {
      sum14 += precipitation[i];
    }

    if (ms <= ms7) {
      sum7 += precipitation[i];
    }

    if (ms <= ms2) {
      sum2 += precipitation[i];
    }

    if (ms <= ms1) {
      sum1 += precipitation[i];
    }
  }

  qs('#precipitation1').innerText = formatPrecipitation(sum1);
  qs('#precipitation2').innerText = formatPrecipitation(sum2);
  qs('#precipitation7').innerText = formatPrecipitation(sum7);
  qs('#precipitation14').innerText = formatPrecipitation(sum14);
};

const refresh = async () => {
  const data = await loadData();
  showElevations(data);
  showPrecipitation(data);
};

document.addEventListener('DOMContentLoaded', refresh);
window.addEventListener('focus', refresh);