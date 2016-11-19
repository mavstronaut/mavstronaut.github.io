/*
  Makes a full-page display of startup revenue, expense, growth, and capital needed.
  It's all one canvas with draggable bits.
  The actual math is in oommodel.js

  See tlbcore doc for $.defPages, $.mkAnimatedCanvas

  Reference [Don’t be the startup that accidentally runs out of money](https://news.ycombinator.com/item?id=7239975)
*/

var oommodel            = require('./oommodel');

$.defPage('', 
          function(o) {
            var top = this;
            var m = new oommodel.OomModel(o);

            var winW, winH;
            console.log('OomModel stored in window.oom0 for your convenience');
            window.oom0 = m;

            top.html('<div class="oomView"><canvas class="oomCanvas"></canvas></div>' +
                     '<div class="oomBlurb"></div>');

            top.find('.oomCanvas').mkAnimatedCanvas(m, drawOom, {});
            top.find('.oomBlurb').fmtOomBlurb();

            top.children().first().bogartWindowEvents({
              'resize': onWindowResize
            }).bogartBodyEvents({
              'keydown': onBodyKeydown
            });

            m.on('changed', function() {
              replaceLocationHash('', m.asParms());
            });
            
            getSizes();
            adjustSizes();
            top.animation2(m);
            m.emit('changed');
            return this;

            function onBodyKeydown(ev) {
              if ($('#popupEditUrl').length) return; // argh. 
              if (ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey && ev.which === 87) { // C-W
                m.setUnits('week');
                return false;
              }
              else if (ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey && ev.which === 77) { // C-M
                m.setUnits('month');
                return false;
              }
              else if (ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey && ev.which === 89) { // C-Y
                m.setUnits('year');
                return false;
              }
            }

            function onWindowResize(ev) {
              if (top.find('.oomCanvas').length === 0) return false;
              if (getSizes()) adjustSizes();
            }

            function getSizes() {
              var oldWinW = winW, oldWinH = winH;
              winW = Math.max(500, $(window).width());
              winH = Math.max(400, $(window).height());
              return (winW !== oldWinW || winH !== oldWinH);
            }
            
            /*
              Because I can't figure out how to make full-page layouts in CSS.
            */
            function adjustSizes() {
              var padL = 5, padR = 5;
              var footerH = 70;
              var headerH = 10;
              var mainW = winW - padL - padR;
              var mainH = winH - headerH - footerH - 10;
              top.find('.oomView').each(function() {
                $(this).css({
                  width: (mainW).toString() + 'px', 
                  height: (mainH).toString() + 'px',
                  left: (padL).toString() + 'px',
                  top: (headerH).toString() + 'px'
                });
                var canvas = $(this).find('.oomCanvas')[0];
                canvas.height = mainH;
                canvas.width = mainW;
                $(this).maximizeCanvasResolution();
                m.emit('changed');
              });
            }
          });

$.fn.fmtOomEmbed = function(o) {
  var top = this;
  var m = new oommodel.OomModel(o);

  top.html('<div class="oomView"><canvas width="800" height="480" class="oomCanvas"></canvas></div>');
  top.maximizeCanvasResolution();
  top.find('.oomCanvas').mkAnimatedCanvas(m, drawOom, {});
  top.animation2(m);
  m.emit('changed');
  return this;
};

$.fn.fmtOomFooter = function(o) {
  this.html('<center>' +
            '<span class="footer"><a href="#about">About</a></span>' +
            '</center>');
  return this;
};

$.fn.fmtOomBlurb = function(o) {
  this.html('<div class="oomAbout">' +
            '<p>This tool calculates how much funding your startup needs. Assuming your expenses are '+
            'constant and your revenue is growing, it shows when you\'ll reach profitability '+
            'and how much capital you\'ll burn through before then. ' +
            'Once you\'re profitable, you control your destiny: you can raise more to grow faster if you want.</p>' +
            '<p>You can drag the red or green handles to set expense, revenue and growth. Geometrically, ' +
            'the capital needed is the blue-shaded area between the revenue and expense curves.</p>' +
            '<p>If you raised exactly the amount calculated and everything goes as expected, your bank account '+
            'would be at $0 the month you hit profitability, which is kind of stressful. So raise a comfortable margin above it.</p>' +
            '<p>By default it shows weekly rates, but there\'s a button to use monthly or yearly rates. ' +
            'The code is on <a href="https://www.github.com/tlbtlbtlb/startuptools">github</a> if you\'re curious how it works.</p>' +
            '</div>' +
            '<center>' +
            '<span class="footer">By Trevor Blackwell</span>' +
            '</center>'
           );
}

$.fn.expandOomEmbed = function() {
  var top = this;
  // Example: <div class="oomEmbed" modelOpts="{&quot;duration&quot;:261,&quot;revGrowth&quot;:0.015,&quot;maxFlow&quot;:3e5}">

  top.find('.oomEmbed').each(function(el) {
    var embed = $(this);
    var modelOpts = JSON.parse(embed.attr('modelOpts'));
    console.log(modelOpts);
    embed.fmtOomEmbed(modelOpts);
  });
};

/*
  Formatters
*/

var weeksPerYear = 365.2425 / 7;
var weeksPerMonth = 365.2425 / 7 / 12;

function weekToMonthGrowth(weeklyGrowth) {
  return Math.exp(Math.log(1+weeklyGrowth) * weeksPerMonth)-1;
}

function fmtTime(week, units, digits) {
  if (!digits) digits = 0;
  switch(units) {
  case 'week':
    return 'week ' + week.toFixed(digits);
  case 'month':
    return 'month ' + (week / weeksPerMonth).toFixed(digits);
  case 'year':
    return 'year ' + (week / weeksPerYear).toFixed(digits);
  default:
    throw new Error('unknown units ' + units);
  }
}

function fmtPercentage(v, digits, stz) {
  v *= 100;
  if (v !== 0) {
    digits = Math.max(0, digits - Math.ceil(Math.log(Math.abs(v))/Math.log(10)+0.001));
  }
  var asFixed = v.toFixed(digits);
  if (stz) asFixed = asFixed.replace(/0+$/, '');
  return asFixed + '%';
}

function fmtGrowth(weeklyGrowth, units, digits, showUnits) {
  if (!digits) digits = 0;
  switch(units) {
  case 'week':
    return fmtPercentage(weeklyGrowth, digits) + (showUnits ? ' weekly' : '');
  case 'month':
    return fmtPercentage(Math.exp(Math.log(1+weeklyGrowth) * weeksPerMonth) - 1, digits) + (showUnits ? ' monthly' : '');
  case 'year':
    return fmtPercentage(Math.exp(Math.log(1+weeklyGrowth) * weeksPerYear) - 1, digits) + (showUnits ? ' yearly' : '');
  default:
    throw new Error('unknown units ' + units);
  }
}

function fmtFlow(weeklyFlow, units, digits, showUnits) {
  if (!digits) digits = 0;
  switch(units) {
  case 'week':
    return fmtMoney(weeklyFlow, digits) + (showUnits ? ' weekly' : '');
  case 'month':
    return fmtMoney(weeklyFlow * weeksPerMonth, digits) + (showUnits ? ' monthly' : '');
  case 'year':
    return fmtMoney(weeklyFlow * weeksPerYear, digits) + (showUnits ? ' yearly' : '');
  default:
    throw new Error('unknown units ' + units);
  }
}

function fmtUnits(units) {
  switch(units) {
  case 'week': 
    return 'Weekly';
  case 'month':
    return 'Monthly';
  case 'year':
    return 'Yearly';
  default:
    throw new Error('unknown units ' + units);
  }
}

function fmtMoney(v, digits) {
  var suffix = '';
  if (v >= 100e12) { // Don't show silly numbers
    return 'Unreasonable';
  }
  if (v >= 1e12) {
    suffix = 'T';
    v /= 1e12;
  }
  else if (v >= 1e9) {
    suffix = 'B';
    v /= 1e9;
  }
  else if (v >= 1e6) {
    suffix = 'M';
    v /= 1e6;
  }
  else if (v >= 1e4) {
    suffix = 'k';
    v /= 1e3;
  }
  else {
    suffix = '';
  }
  if (v >= 1000) {
    digits = Math.max(0, digits-4);
  }
  else if (v >= 100) {
    digits = Math.max(0, digits-3);
  }
  else if (v >= 10) {
    digits = Math.max(0, digits-2);
  }
  else if (v >= 1) {
    digits = Math.max(0, digits-1);
  }

  return '$' + v.toFixed(digits) + suffix;
}

function getGrowthRates(units) {
  switch (units) {
  case 'week':
    return [0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1];
  case 'month':
    return _.map([0, 0.025, 0.05, 0.075, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50], function(mgr) {
      return Math.exp(Math.log(1+mgr) / weeksPerMonth) - 1;
    });
  case 'year':
    return _.map([0, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 50.0, 100.0], function(ygr) {
      return Math.exp(Math.log(1+ygr) / weeksPerYear) - 1;
    });
  default:
    throw new Error('unknown units ' + units);
  }
}

function getFlows(units) {
  switch (units) {
  case 'week':
    return [100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1e6, 3e6, 1e7];
  case 'month':
    return _.map([300, 1000, 3000, 10000, 30000, 100000, 300000, 1e6, 3e6, 1e7, 3e7], function(mfr) {
      return mfr / weeksPerMonth;
    })
  case 'year':
    return _.map([3000, 10000, 30000, 100000, 300000, 1e6, 3e6, 1e7, 3e7, 1e8], function(yfr) {
      return yfr / weeksPerYear;
    });
  default:
    throw new Error('unknown units ' + units);
  }
}


/*
  Canvas drawing helpers
*/

function drawDragHandle(ctx, cX, cY, radius, style) {
  ctx.beginPath();

  ctx.lineWidth = radius/4;
  switch(style) {
  case 'exp': ctx.fillStyle = mkShinyPattern(ctx, cY-radius, cX+radius, cY+radius, cX-radius, '#b20000', '#ff0000'); break;
  case 'rev': ctx.fillStyle = mkShinyPattern(ctx, cY-radius, cX+radius, cY+radius, cX-radius, '#008e00', '#00cc00'); break;
  }
  ctx.arc(cX, cY, radius, 0, Math.PI*2);
  ctx.fill();

  switch(style) {
  case 'exp': ctx.strokeStyle = '#b20000'; break;
  case 'rev': ctx.strokeStyle = '#007a00'; break;
  }
  ctx.stroke();
  ctx.beginPath();
  switch(style) {
  case 'exp': 
    ctx.fillStyle = '#ff0000';
    ctx.arc(cX, cY, 0.2*radius, 0, 2*Math.PI);
    ctx.fill();
    break;
  case 'rev': 
    ctx.fillStyle = '#00ff00';
    ctx.arc(cX, cY, 0.2*radius, 0, 2*Math.PI);
    ctx.fill();
    break;
  }
}

/*
  Draw everything in the canvas (through ctx), and associate callbacks with clickable 
  or draggable areas.

  This gets called whenever something changes (but by using requestAnimationFrame, 
  only once per screen refresh) and it redraws everything from scratch.

  m: an OomModel
  ctx: an HTML5 2D canvas rendering context.
  hd: a HitDetector (from tlbcore)
  lo: a layout object, containing at least {boxL, boxT, boxR, boxB} for the canvas dimensions
  o: options, not used here
*/
function drawOom(m, ctx, hd, lo, o) {
  
  setupLayout();
  drawTitle();
  drawInstructions();
  drawAxes();
  drawCapital();
  drawExp();
  drawRev();
  drawBreakeven();
  drawIpo();
  drawXLabels();
  drawYLabels();
  return;

  function setupLayout() {
    /*
      Leave some margins around the plot for axis labels etc.
     */
    lo.labelW = 60;
    lo.plotL = lo.boxL + 0.25*(lo.boxR-lo.boxL) + 5 + lo.labelW;
    lo.plotR = lo.boxR - 20;
    lo.plotT = lo.boxT + 45;
    lo.plotB = lo.boxB - 30;
    lo.dragRad = 6;

    /*
      These functions, which had better be correct inverses of each other, define the X and Y scaling of the plot
     */
    lo.convWeekToX = function(week) {
      return (week / m.nWeeks) * (lo.plotR - lo.plotL) + lo.plotL;
    };
    lo.convXToWeek = function(x) {
      return (x - lo.plotL) / (lo.plotR - lo.plotL) * m.nWeeks;
    };
    lo.convFlowToY = function(flow) {
      return (Math.log(flow) - Math.log(m.minFlow)) / (Math.log(m.maxFlow) - Math.log(m.minFlow)) * (lo.plotT - lo.plotB) + lo.plotB;
    };
    lo.convYToFlow = function(y) {
      return Math.exp((y - lo.plotB) / (lo.plotT - lo.plotB) * (Math.log(m.maxFlow) - Math.log(m.minFlow)) + Math.log(m.minFlow));
    };
  }

  function drawAxes() {
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = lo.thinWidth;
    ctx.beginPath();
    ctx.moveTo(lo.plotL, lo.plotB);
    ctx.lineTo(lo.plotR, lo.plotB);
    ctx.stroke();
  }

  function drawXLabels() {
    ctx.font = '12px Arial';
    for (var week=0, year=0; week <= m.nWeeks; week+=weeksPerYear, year += 1) {
      var label = 'year ' + year.toString();
      var weekX = lo.convWeekToX(week);

      ctx.beginPath();
      ctx.moveTo(weekX, lo.plotB);
      ctx.lineTo(weekX, lo.plotB+7);

      ctx.strokeStyle = '#888888';
      ctx.lineWidth = lo.thinWidth;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, weekX, lo.plotB + 10);
    }
  }

  function drawYLabels() {
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Revenue/Expense', lo.plotL, lo.plotT-30);

    ctx.beginPath();
    ctx.moveTo(lo.plotL, lo.plotB);
    ctx.lineTo(lo.plotL, lo.plotT);
    ctx.moveTo(lo.weeklyAxisR, lo.plotB);
    ctx.lineTo(lo.weeklyAxisR, lo.plotT);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = lo.thinWidth;
    ctx.stroke();

    ctx.font = '12px Arial';
    ctx.textBaseline = 'middle';
    var flows = getFlows(m.units);
    _.each(flows, function(flow) {
      if (flow <= m.maxFlow) {
        var label = fmtFlow(flow, m.units, 2, false);
        var flowY = lo.convFlowToY(flow);

        ctx.beginPath();
        ctx.moveTo(lo.plotL, flowY);
        ctx.lineTo(lo.plotL-10, flowY);
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = lo.thinWidth;
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lo.plotL-12, flowY);
      }
    });
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    var label = fmtUnits(m.units);
    ctx.fillText(label, lo.plotL-4, lo.plotT-8);

    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    var label = 'change';
    var labelW = ctx.measureText(label).width;
    hd.add(lo.plotT-20, lo.plotL+labelW+10, lo.plotT-5, lo.plotL, {
      drawCustom: function(hover) {
        if (hover) {
          ctx.fillStyle = '#ee0000';
        } else {
          ctx.fillStyle = '#5555ff';
        }
        ctx.fillText(label, lo.plotL+5, lo.plotT-8);
      },
      onClick: function(mdX, mdY) {
        m.toggleUnits();
      }
    });
      
  }

  function drawCapital() {
    if (m.breakevenWeek > 0) {
      var p0X = lo.convWeekToX(0);
      var p0Y = lo.convFlowToY(m.rev0);
      var p1X = lo.convWeekToX(0);
      var p1Y = lo.convFlowToY(m.exp0);
      var p2X = lo.convWeekToX(m.breakevenWeek);
      var p2Y = lo.convFlowToY(m.breakevenFlow);

      ctx.beginPath();
      ctx.moveTo(p0X, p0Y);
      ctx.lineTo(p1X, p1Y);
      ctx.lineTo(p2X, p2Y);

      if (1) {
        var pat = ctx.createLinearGradient(lo.plotL, lo.plotB, lo.plotL, lo.plotT);
        pat.addColorStop(0.0, 'rgba(200,200,255,0.3)');
        pat.addColorStop(1.0, 'rgba(200,200,255,0.9)');
        ctx.fillStyle = pat;
      } else {
        ctx.fillStyle = 'rgba(200,200,255,0.3)';
      }
      ctx.fill();
    }
    ctx.font = 'bold 15px Arial';
    var label = m.capitalNeeded >= 0 ? (fmtMoney(m.capitalNeeded, 3) + ' capital needed') : 'Infinite capital needed';
    var labelW = ctx.measureText(label).width;
    var lbWeek = m.breakevenWeek > 0 ? Math.min(20, m.breakevenWeek / 4) : 20;
    var lbX = lo.plotL + 15;
    var lbY = (lo.convFlowToY(m.revAtWeek(lbWeek)) + 2*lo.convFlowToY(m.expAtWeek(lbWeek))) / 3;

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lbX, lbY);
  }

  function drawRev() {
    var p0X = lo.convWeekToX(0);
    var p0Y = lo.convFlowToY(m.rev0);
    var p1Week = Math.max(10, Math.min(m.nWeeks, m.ipoWeek));
    var p1X = lo.convWeekToX(p1Week);
    var p1Y = lo.convFlowToY(m.revAtWeek(p1Week));

    var p01Len = Math.sqrt(Math.pow(p1X-p0X, 2) + Math.pow(p1Y-p0Y, 2));
    var protRad = Math.max(330, Math.max((lo.plotB-lo.plotT)*0.6, (lo.plotR - lo.plotL)*0.3)); // radius of our protractor
    var pmX = p0X + (p1X-p0X)*protRad/p01Len;
    var pmY = p0Y + (p1Y-p0Y)*protRad/p01Len;

    ctx.textLayer(function() {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = lo.thinWidth;
      var growthRates = getGrowthRates(m.units);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      var maxAngle = 0;
      _.each(growthRates, function(growthRate, growthRateIndex) {
        var p3X = lo.convWeekToX(p1Week);
        var p3Y = lo.convFlowToY(Math.exp(m.rev0Log + Math.log(1+growthRate) * p1Week));
        var angle = Math.atan2(p3Y-p0Y, p3X-p0X);
        maxAngle = Math.min(maxAngle, angle);
        var p03Len = Math.sqrt(Math.pow(p3X-p0X, 2) + Math.pow(p3Y-p0Y, 2));
        ctx.save();
        ctx.translate(p0X, p0Y);
        ctx.rotate(angle);
        ctx.moveTo(protRad+0, 0);
        ctx.lineTo(protRad+10, 0);
        ctx.stroke();
        var label = fmtGrowth(growthRate, m.units, 2, false);
        ctx.fillText(label, protRad+12, 0);
        ctx.restore();
      });
      maxAngle -= 0.03;  // radians
      ctx.beginPath();
      if (0) ctx.moveTo(p0X + protRad*0.5, p0Y);
      ctx.arc(p0X, p0Y, protRad, 0, maxAngle, true);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(p0X, p0Y);
    ctx.lineTo(p1X, p1Y);
    ctx.strokeStyle = '#aaf5aa';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.buttonLayer(function() {
      var angle = Math.atan2(pmY-p0Y, pmX-p0X);
      ctx.save();
      ctx.translate(p0X, p0Y);
      ctx.rotate(angle);
      
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 15px Arial';
      
      var label = 'growing ' + fmtGrowth(m.revGrowth, m.units, 3, false);
      var labelW = ctx.measureText(label).width;
      
      if (0) {
        ctx.beginPath();
        drawRountangle(ctx, protRad-24-labelW, -8, protRad, +8, 5);
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.fill();
      }
      
      ctx.fillStyle='#000000';
      ctx.fillText(label, protRad-12, 0);
      ctx.restore();
      
    });

    ctx.buttonLayer(function() {
      var angle = Math.atan2(pmY-p0Y, pmX-p0X);
      ctx.save();
      ctx.translate(p0X, p0Y);
      ctx.rotate(angle);

      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      var label = fmtFlow(m.rev0, m.units, 3, true) + ' revenue';
      var labelW = ctx.measureText(label).width;

      if (0) {
        ctx.beginPath();
        drawRountangle(ctx, 10, -8, 20+labelW, +8, 5);
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.fill();
      }

      ctx.fillStyle = '#000000';
      ctx.fillText(label, 15, 0);
      ctx.restore();
    });

    hd.add(p0Y-lo.dragRad, p0X+lo.dragRad, p0Y+lo.dragRad, p0X-lo.dragRad, {
      draw: function() {
        drawDragHandle(ctx, p0X, p0Y, lo.dragRad, 'rev');
      },
      onDown: function(mdX, mdY) {
        hd.dragging = function(dragX, dragY) {
          var newRev = lo.convYToFlow(dragY);
          m.setRevAtWeek(0, newRev);
          m.everDragged = true;
        };
      },
      onHover: function() {
        drawTooltip(ctx, lo, p0X, p0Y, 'Drag to change initial revenue');
      }});

    hd.add(pmY-lo.dragRad, pmX+lo.dragRad, pmY+lo.dragRad, pmX-lo.dragRad, {
      draw: function() {
        drawDragHandle(ctx, pmX, pmY, lo.dragRad, 'rev');
      }, 
      onDown: function(mdX, mdY) {
        hd.dragging = function(dragX, dragY) {
          var newWeek = lo.convXToWeek(dragX);
          var newRev = lo.convYToFlow(dragY);
          m.setRevAtWeek(newWeek, newRev);
          m.everDragged = true;
        };
      }, 
      onHover: function() {
        drawTooltip(ctx, lo, pmX, pmY, 'Drag to change revenue growth rate');
      }});
  }

  function drawExp() {
    var p0X = lo.convWeekToX(0);
    var p0Y = lo.convFlowToY(m.exp0);
    var p1Week = m.nWeeks;
    var p1X = lo.convWeekToX(p1Week);
    var p1Y = lo.convFlowToY(m.expAtWeek(p1Week));
    
    ctx.beginPath();
    ctx.moveTo(p0X, p0Y);
    ctx.lineTo(p1X, p1Y);
    ctx.strokeStyle = '#f5bbbb';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.buttonLayer(function() {
      var angle = Math.atan2(p1Y-p0Y, p1X-p0X);
      ctx.save();
      ctx.translate(p0X, p0Y);
      ctx.rotate(angle);

      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      var label = fmtFlow(m.exp0, m.units, 3, true) + ' expense';
      var labelW = ctx.measureText(label).width;

      if (0) {
        ctx.beginPath();
        drawRountangle(ctx, -8, 20+labelW, 8, 10, 5);
        ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.fill();
      }

      ctx.fillStyle = '#000000';
      ctx.fillText(label, 15, 0);
      ctx.restore();
    });

    hd.add(p0Y-lo.dragRad, p0X+lo.dragRad, p0Y+lo.dragRad, p0X-lo.dragRad, {
      draw: function() {
        drawDragHandle(ctx, p0X, p0Y, lo.dragRad, 'exp');
      },
      onDown: function(mdX, mdY) {
        hd.dragging = function(dragX, dragY) {
          var newExp = lo.convYToFlow(dragY);
          m.setExpAtWeek(0, newExp);
          m.everDragged = true;
        };
      },
      onHover: function() {
        drawTooltip(ctx, lo, p0X, p0Y, 'Drag to change initial expense');
      }});
  }

  function drawBreakeven() {
    if (m.breakevenWeek < 0 || m.breakevenWeek > 30*52) return;

    var label = 'Profitable at ' + fmtTime(m.breakevenWeek, 'year', 1);
    var drawArrow = lo.convWeekToX(m.breakevenWeek) > lo.plotR;
    
    if (drawArrow) {
      var p0X = lo.plotR;
      var p0Y = Math.min(lo.convFlowToY(m.breakevenFlow), lo.convFlowToY(m.expN)-10);
      var p1X = lo.plotR-20;
      var p1Y = Math.min(p0Y, lo.convFlowToY(m.expN)-10);
    
      ctx.moveTo(p0X, p0Y);
      ctx.lineTo(p1X, p1Y);
      ctx.moveTo(p0X, p0Y);
      ctx.lineTo(p0X-8, p0Y-3);
      ctx.moveTo(p0X, p0Y);
      ctx.lineTo(p0X-8, p0Y+3);
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = '15px Arial';
      var labelW = ctx.measureText(label).width

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillText(label, p1X-5, p1Y);
    } else {
      var p0X = lo.convWeekToX(m.breakevenWeek);
      var p0Y = lo.convFlowToY(m.breakevenFlow);
      var p1X = lo.convWeekToX(m.breakevenWeek);
      var p1Y = p0Y + 20; // lo.plotB;
      
      ctx.moveTo(p0X, p0Y);
      ctx.lineTo(p1X, p1Y);
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = '15px Arial';
      var labelW = ctx.measureText(label).width
      if (p1X + labelW + 10 > lo.plotR) {
        ctx.textBaseline = 'top';
        ctx.textAlign = 'right';
        ctx.fillText(label, p1X+3, p1Y+1);
      } else {
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(label, p1X-3, p1Y+1);
      }
    }
  }

  function drawIpo() {
    if (m.ipoWeek < 0 || m.ipoWeek > 30*52) return;

    var drawArrow = lo.convWeekToX(m.ipoWeek) > lo.plotR;
    var p0X = drawArrow ? lo.plotR : lo.convWeekToX(m.ipoWeek);
    var p0Y = lo.convFlowToY(m.revAtWeek(m.ipoWeek));
    var label = '$100M/yr revenue at ' + fmtTime(m.ipoWeek, 'year', 1);
    var p1X = Math.min(lo.plotR-20, p0X-20);
    var p1Y = p0Y;
    
    ctx.moveTo(p0X, p0Y);
    ctx.lineTo(p1X, p1Y);
    if (drawArrow) {
      ctx.moveTo(p0X, p0Y);
      ctx.lineTo(p0X-8, p0Y-3);
      ctx.moveTo(p0X, p0Y);
      ctx.lineTo(p0X-8, p0Y+3);
    }
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = '15px Arial';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(label, p1X-5, p1Y);
  }
  
  function drawTitle() {
    var cX = (lo.plotL + lo.plotR)/2;
    var lY = lo.boxT + 2;
    var title = 'Startup Growth Calculator';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(title, cX, lY);
  }

  function drawInstructions() {
    if (!(m.showInstructions > 0)) return;
    var cX = (lo.plotL + lo.plotR)/2;
    var lY = lo.plotT + 100;

    ctx.save();
    ctx.globalAlpha = (1 - Math.cos(m.showInstructions*Math.PI)) / 2;

    ctx.font = '25px Arial';
    lines=[
      'How much money will you burn before your startup is profitable?',
      'Drag the red and green handles to change expense and revenue',
      'The shaded blue area shows how much money you\'ll need'
    ];
    var linesW = 100;
    _.each(lines, function(line) { 
      linesW = Math.max(linesW, ctx.measureText(line).width);
    });

    ctx.beginPath();
    drawRountangle(ctx, lY-30, cX+linesW/2+20, lY+(lines.length-1)*35+30, cX-linesW/2-20, 10);
    ctx.fillStyle = '#ffcc66';
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    _.each(lines, function(line, linei) {
      ctx.fillText(line, cX, lY + linei*35);
    });

    ctx.restore();
  }
}
