exports.OomModel = OomModel;

/*
  Represent the growth and funding trajectory for a startup.
  Start with initial revenue and expenses, both growing at some constant rate.
  Calculate the time until breakeven, and the amount of capital needed to get there.
  Everything here is in dollars and weeks. OomView also displays things in month and year units.

*/

var oomDefaults = {
  units: 'week',
  uiDebug: false,
  nWeeks: Math.round(3 * 365.2425 / 7),
  minFlow: 40,
  maxFlow: 2100000,
  rev0: 100,
  revGrowth: 0.025,
  exp0: 1600,
  expGrowth: 0.0
};

function OomModel(o) {
  var m = this;

  m.units = _.limitToSelection(['week', 'month', 'year'], o.units);   // display units only, everything here is still kept in week units
  m.uiDebug = !!o.uiDebug;

  m.rev0 = o.rev0 ? o.rev0 : oomDefaults.rev0;
  m.revGrowth = o.revGrowth ? o.revGrowth : oomDefaults.revGrowth;
  m.exp0 = o.exp0 ? o.exp0 : oomDefaults.exp0;
  m.expGrowth = o.expGrowth ? o.expGrowth : oomDefaults.expGrowth;

  m.minFlow = o.minFlow ? o.minFlow : oomDefaults.minFlow;
  m.maxFlow = o.maxFlow ? o.maxFlow : oomDefaults.maxFlow;
  m.nWeeks = o.nWeeks ? o.nWeeks : oomDefaults.nWeeks;

  m.showInstructions = 0.0;
  m.everDragged = false;

  m.calc();
}
OomModel.prototype = Object.create(EventEmitter.prototype);

OomModel.prototype.asParms = function() {
  var m = this;
  return {
    units: (m.units !== oomDefaults.units) ? m.units : undefined,
    uiDebug: (m.uiDebug !== oomDefaults.uiDebug) ? true : undefined,
    rev0: (m.rev0 !== oomDefaults.rev0) ? m.rev0 : undefined,
    exp0: (m.exp0 !== oomDefaults.exp0) ? m.exp0 : undefined,
    revGrowth: (m.revGrowth !== oomDefaults.revGrowth) ? m.revGrowth : undefined,
    expGrowth: (m.expGrowth !== oomDefaults.expGrowth) ? m.expGrowth : undefined,
    minFlow: (m.minFlow !== oomDefaults.minFlow) ? m.minFlow : undefined,
    maxFlow: (m.maxFlow !== oomDefaults.maxFlow) ? m.maxFlow : undefined,
    nWeeks: (m.nWeeks !== oomDefaults.nWeeks) ? m.nWeeks : undefined
  }
};

OomModel.prototype.setUnits = function(units) {
  var m = this;
  m.units = units;
  m.calc();
};

OomModel.prototype.toggleUnits = function() {
  var m = this;
  if (m.units === 'week') {
    return m.setUnits('month');
  }
  else if (m.units === 'month') {
    return m.setUnits('year');
  }
  else {
    return m.setUnits('week');
  }
};

/*
  Set revenue/expense at a given time. Supports dragging sliders in the UI.
  If week is zero, change the initial value, otherwise change growth
*/
OomModel.prototype.setRevAtWeek = function(week, rev) {
  var m = this;
  if (week === 0) {
    m.rev0 = Math.round(rev);
  } else {
    m.revGrowth = Math.exp(Math.log(rev / m.rev0) / week) - 1;
  }
  m.calc();
};
OomModel.prototype.setExpAtWeek = function(week, exp) {
  var m = this;
  if (week === 0) {
    m.exp0 = Math.round(exp);
  } else {
    m.expGrowth = Math.exp(Math.log(exp / m.exp0) / week) - 1;
  }
  m.calc();
};

/*
  Return revenue/expense at a given week
*/
OomModel.prototype.revAtWeek = function(week) {
  var m = this;
  return Math.exp(m.rev0Log + m.revLogGrowth * week);
};
OomModel.prototype.expAtWeek = function(week) {
  var m = this;
  return Math.exp(m.exp0Log + m.expLogGrowth * week);
};

/*
  Evolve the model forward/backward in time by the given number of weeks.
*/
OomModel.prototype.evolve = function(weeks) {
  var m = this;
  m.exp0 *= Math.exp(m.expLogGrowth * weeks);
  m.rev0 *= Math.exp(m.revLogGrowth * weeks);
  m.calc();
};

/*
  Calculate all derived properties
*/
OomModel.prototype.calc = function() {
  var m = this;

  m.rev0Log = Math.log(m.rev0);
  m.exp0Log = Math.log(m.exp0);
  m.revLogGrowth = Math.log(1 + m.revGrowth);
  m.expLogGrowth = Math.log(1 + m.expGrowth);

  m.revNLog = m.rev0Log + m.revLogGrowth * m.nWeeks;
  m.expNLog = m.exp0Log + m.expLogGrowth * m.nWeeks;

  m.revN = Math.exp(m.revNLog);
  m.expN = Math.exp(m.expNLog);
  
  /*
    solve for exp(rev0Log + n*revLogGrowth) === exp(exp0Log + n*expLogGrowth);
    n = (exp0Log - rev0Log) / (revLogGrowth - expLogGrowth)
  */
  if (m.exp0Log > m.rev0Log) {
    m.breakevenWeek = (m.exp0Log - m.rev0Log) / (m.revLogGrowth - m.expLogGrowth);
    m.breakevenFlow = Math.exp(m.rev0Log + m.revLogGrowth * m.breakevenWeek);

    /*
      Integrate revenue from 0 to breakeven
    */
    m.breakevenTotRev = m.rev0 * (m.revLogGrowth === 0 ? m.breakevenWeek : ((Math.exp(m.revLogGrowth * m.breakevenWeek) - 1) / m.revLogGrowth));
    m.breakevenTotExp = m.exp0 * (m.expLogGrowth === 0 ? m.breakevenWeek : ((Math.exp(m.expLogGrowth * m.breakevenWeek) - 1) / m.expLogGrowth));
    m.capitalNeeded = m.breakevenTotExp - m.breakevenTotRev;

  } else {
    m.breakevenWeek = 0;
    m.breakevenFlow = m.rev0;
    m.breakevenTotRev = 0;
    m.breakevenTotExp = 0;
    m.capitalNeeded = 0;
  }


  // when will we make 100M / yr?
  m.ipoWeek = (Math.log(1e8/52) - m.rev0Log) / m.revLogGrowth;
  m.emit('changed');
};

/*
  If we're animating the UI, move forward by dt seconds.
*/
OomModel.prototype.animate = function(dt) {
  var m = this;
  if (m.everDragged && m.showInstructions > 0) {
    m.showInstructions = Math.max(0, m.showInstructions - 0.8 * dt);
    m.emit('changed');
  }
};

