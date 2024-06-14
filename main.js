import {
    ColumnType,
    getChartContext,
    ChartToTSEvent,
  } from '@thoughtspot/ts-chart-sdk';
  import _ from 'lodash';
  debugger;
  const numberFormatter = value => {
    if (value > 1000000000) {
      return (value / 1000000000).toFixed(2) + 'B';
    }
    if (value > 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    }
    if (value > 1000) {
      return (value / 1000).toFixed(2) + 'K';
    }
    return value.toFixed(2);
  };
  
  function getDataForColumn(column, dataArr) {
    const idx = _.findIndex(dataArr.columns, colId => column.id === colId);
    return _.map(dataArr.dataValue, row => row[idx]);
  }
  
  function calculateKpiValues(chartModel) {
    const dataArr = chartModel.data?.[0]?.data ?? [];
    const measureColumns = _.filter(chartModel.columns, col => col.type === ColumnType.MEASURE);
  
    if (measureColumns.length === 0 || dataArr.length === 0) return { mainKpiValue: 0, measures: [] };
  
    const mainKpiValue = _.sum(getDataForColumn(measureColumns[0], dataArr));
    const measures = measureColumns.slice(1).map(col => {
      const value = _.sum(getDataForColumn(col, dataArr));
      const change = ((mainKpiValue - value) / value) * 100;
      return {
        label: col.name,
        value,
        change
      };
    });
  
    return { mainKpiValue, measures };
  }
  
  function updateKpiContainer(measures, mainKpiValue) {
    document.getElementById('mainKpiValue').innerText = `$${numberFormatter(mainKpiValue)}`;
    const kpiContainer = document.getElementById('kpiMeasures');
    kpiContainer.innerHTML = '';
    measures.forEach(measure => {
      const changeClass = measure.change > 0 ? 'kpi-positive' : 'kpi-negative';
      const measureDiv = document.createElement('div');
      measureDiv.classList.add('kpi-measure');
      measureDiv.innerHTML = `
        <span class="${changeClass}">${measure.change.toFixed(1)}%</span>
        <span>(${numberFormatter(measure.value)}) vs. ${measure.label}</span>
      `;
      kpiContainer.appendChild(measureDiv);
    });
  }
  
  async function render(ctx) {
    const chartModel = ctx.getChartModel();
    console.log('Chart Model:', chartModel); // Add logging to debug data
    const kpiValues = calculateKpiValues(chartModel);
    console.log('KPI Values:', kpiValues); // Add logging to debug KPI values
    updateKpiContainer(kpiValues.measures, kpiValues.mainKpiValue);
  }

  const renderChart = async (ctx) => {
    try {
        ctx.emitEvent(ChartToTSEvent.RenderStart);
        render(ctx);
    } catch (e) {
        ctx.emitEvent(ChartToTSEvent.RenderError, {
            hasError: true,
            error: e,
        });
    } finally {
        ctx.emitEvent(ChartToTSEvent.RenderComplete);
    }
};
  
  (async () => {
    const ctx = await getChartContext({
      getDefaultChartConfig: (chartModel) => {
        const cols = chartModel.columns;
        const measureColumns = _.filter(cols, col => col.type === ColumnType.MEASURE);
  
        const axisConfig = {
          key: 'column',
          dimensions: [
            {
              key: 'x',
              columns: measureColumns.length > 0 ? [measureColumns[0]] : [],
            },
            {
              key: 'y',
              columns: measureColumns,
            },
          ],
        };
        return [axisConfig];
      },
      getQueriesFromChartConfig: (chartConfig) => {
        const queries = chartConfig.map(config =>
          _.reduce(config.dimensions, (acc, dimension) => ({
            queryColumns: [...acc.queryColumns, ...dimension.columns],
          }), { queryColumns: [] })
        );
        return queries;
      },
      renderChart: ctx => renderChart(ctx),
      chartConfigEditorDefinition: [
        {
          key: 'column',
          label: 'Custom Column',
          descriptionText: 'X Axis can only have attributes, Y Axis can only have measures, Color can only have attributes. ' +
            'Should have just 1 column in Y axis with colors columns.',
          columnSections: [
            {
              key: 'x',
              label: 'Custom X Axis',
              allowAttributeColumns: false,
              allowMeasureColumns: true,
              allowTimeSeriesColumns: true,
              maxColumnCount: 1,
            },
            {
              key: 'y',
              label: 'Custom Y Axis',
              allowAttributeColumns: false,
              allowMeasureColumns: true,
              allowTimeSeriesColumns: false,
            },
          ],
        },
      ],
      visualPropEditorDefinition: {
        elements: [
          {
            key: 'color',
            type: 'radio',
            defaultValue: 'red',
            values: ['red', 'green', 'yellow'],
            label: 'Colors',
          },
          {
            type: 'section',
            key: 'accordion',
            label: 'Accordion',
            children: [
              {
                key: 'Color2',
                type: 'radio',
                defaultValue: 'blue',
                values: ['blue', 'white', 'red'],
                label: 'Color2',
              },
              {
                key: 'datalabels',
                type: 'toggle',
                defaultValue: false,
                label: 'Data Labels',
              },
            ],
          },
        ],
      },
    });
  
    renderChart(ctx);
  })();
  