function zoomFiltering(divId) {
    var width = 550, height=400, radius = 100;

  var centerX = width / 2;
  var centerY = height / 2;

    let axisFormat = d3.format(".2f");

    var svg = d3.select(divId)
                .append('svg')
                .attr('width', width)
                .attr('height', height)

  var gAxis = svg.append('g')
  .attr('transform', `translate(${centerX},${centerY})`);

  var origCircleScale1 = d3.scaleLinear().domain([0,1]).range([0, 360]);
  var origCircleScale2 = d3.scaleLinear().domain([0,1]).range([0, 360]);

  let circleScale1 = origCircleScale1.copy();
  let circleScale2 = origCircleScale2.copy();

  // the last midpoint of a zoom action
  let lastMidPoint = 0;

  var prevTransform = d3.zoomIdentity;

    // create 15 circles
  var circles = [{'x': centerX, 'y': centerY, 'r': radius}];

  var line = svg.append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', width)
  .attr('y2', height)
    .attr('stroke', "black")
  .style('visibility', 'hidden')
  ;

  var zoomBehavior = d3.zoom()
  .scaleExtent([1,10])
  //.translateExtent([[0,1],[0,1]]);
  .on('zoom', zoomed);

    var circle = svg.selectAll('circle')
        .data(circles)
        .enter()
        .append('circle')
        .attr('cx', function(d) { return d.x; })
        .attr('cy', function(d) { return d.y; })
        .attr('r', function(d) { return d.r; })
    .on('mouseenter', function(d) {
      line.style('visibility', 'visible')
    })
    .on('mouseout', function(d) {
      line.style('visibility', 'hidden')
    })
    .on('mousemove', function(d) {
      let pos = d3.mouse(svg.node());
      positionLine(pos[0], pos[1]);

    });

  circle.call(zoomBehavior);

  function zoomed() {
    /*
    circleScale1 = d3.event.transform.rescaleX(circleScale1);
    circleScale1 = d3.event.transform.rescaleY(circleScale2);
    */
    let pos = d3.mouse(svg.node());
    let [zgamma1, zgamma2] = getChordEndpointAngles(pos[0], pos[1]);

    let r1 = 360 * (zgamma1 / (2 * Math.PI));
    let d1 = circleScale1.invert(r1);
    let tn = r1 - d3.event.transform.k * origCircleScale1(d1);

    let r2 = 360 * (zgamma2 / (2 * Math.PI));
    let d2 = circleScale2.invert(r2);
    let to = r2 - d3.event.transform.k * origCircleScale2(d2);

    prevTransform = d3.event.transform;
    prevTransform.x = tn;
    prevTransform.y = to;

    zoomBehavior.on('zoom', null);
    circle.call(zoomBehavior.transform, prevTransform);
    zoomBehavior.on('zoom', zoomed);

    circleScale1 = prevTransform.rescaleX(origCircleScale1);
    circleScale2 = prevTransform.rescaleY(origCircleScale2);

    lastMidPoint = (r1 + r2) / 2;

    drawAxis();
  }

  function getChordEndpointAngles(mouseX, mouseY) {
    /**
     * Get the endpoints of the minimum coord spanning
     * this mouse position
     */
    var circleX = mouseX - centerX;
    var circleY = mouseY - centerY;

    if (circleX ** 2 + circleY ** 2  > radius ** 2)  {
      // the mouse is out of circle
      return;
    }

    var beta = Math.atan2(circleY, circleX)
    var cp = Math.sqrt(circleX ** 2  + circleY ** 2);
    var alpha = Math.acos(cp / radius);

    var gamma1 = beta + alpha;
    var gamma2 = beta - alpha;

    gamma1 = gamma1 < 0 ? 2 * Math.PI + gamma1 : gamma1;
    gamma2 = gamma2 < 0 ? 2 * Math.PI + gamma2 : gamma2;

    let x = [gamma1,gamma2].sort((a,b) => (+a) - (+b));
    [gamma1, gamma2] = x;

    return [gamma1, gamma2];
  }

  function positionLine(mouseX, mouseY) {
    // Position the line so that it creates a chord which
    // is bisected by the mouse position
    var [gamma1, gamma2] = getChordEndpointAngles(mouseX, mouseY);
    
    var x1 = centerX + radius * Math.cos(gamma1);
    var x2 = centerX + radius * Math.cos(gamma2);

    var y1 = centerY + radius * Math.sin(gamma1);
    var y2 = centerY + radius * Math.sin(gamma2);

    line.attr('x1', x1)
      .attr('x2', x2)
      .attr('y1', y1)
      .attr('y2', y2)
  }

  function drawAxis() {

    var axisScales = [circleScale1, circleScale2];

    var ticks = axisScales[0].ticks(10);

    var axisTexts = gAxis.selectAll('.axis-text')
      .data(ticks, function(d) { return d })
  
    axisTexts.exit().remove()

    let otherMidPoint = lastMidPoint + 180;
    otherMidPoint = otherMidPoint > 360 ? otherMidPoint - 360 : otherMidPoint;

    console.log('lastMidPoint:', lastMidPoint, otherMidPoint);

    function isCloseToTop(point, midPoint) {
      /*
       * Check if a point has an unbstructed path to the top (270 degrees)
       */

      if (point > 90 && point <= 270) {
        // left
        if (midPoint > point && midPoint < 270)
            // midPoint is between the point and the top
            return false;
      }

      if (point <= 90) {
        // right bottom
        if (midPoint < point || midPoint > 270) {
            return false;
        }
      }

      if (point > 270) {
        if ((midPoint < point && midPoint > 270))  {
          return false;
        }
      }

      return true;
    }


    axisTexts.enter()
      .append('g')
      .classed('axis-text', true)
      .append('text')
      .attr('x', radius)
      .text(function(d) { return axisFormat(d); });

    svg.selectAll('.axis-text')
      .style('visibility', function(d) {
        let closeToTop = false;
        let r = circleScale1(d);

        if (isCloseToTop(r, lastMidPoint) &&
            isCloseToTop(r, otherMidPoint)) {
          closeToTop = true;  
        }
        
        //console.log('d:', d, r, closeToTop);
        return closeToTop ? 'hidden' : 'visible';
      })
      .attr('transform', function(d) { return `rotate(${axisScales[0](d)})` });

    //// draw second axis
    
    ticks = axisScales[1].ticks(10);

    axisTexts = gAxis.selectAll('.axis-2-text')
      .data(ticks, function(d) { return d })
  
    axisTexts.exit().remove()

    axisTexts.enter()
      .append('g')
      .classed('axis-2-text', true)
      .append('text')
      .attr('x', radius + 20)
      .style('fill', 'green')
      .text(function(d) { return axisFormat(d); });

    svg.selectAll('.axis-2-text')
      .style('visibility', function(d) {
        let closeToTop = false;
        let r = circleScale2(d);

        if (isCloseToTop(r, lastMidPoint) &&
            isCloseToTop(r, otherMidPoint)) {
          closeToTop = true;  
        }
        
        //console.log('d:', d, r, closeToTop);
        return closeToTop ? 'visible' : 'hidden';
      })
      .attr('transform', function(d) { return `rotate(${axisScales[1](d)})` });

    //// draw inner axis
    
    ticks = [0,30,60,90,120, 150, 180,210,240,270,300,330];

    axisLines = gAxis.selectAll('.axis-line')
      .data(ticks, function(d) { return d })
  
    axisLines.exit().remove()

    axisLines.enter()
      .append('g')
      .classed('axis-line', true)
      .append('line')
      .attr('x1', radius - 20)
      .attr('x2', radius)
    .style('stroke', 'black')

    svg.selectAll('.axis-line')
      .attr('transform', function(d) { return `rotate(${d})` });

    /// draw breakpoint
    ticks = [lastMidPoint, (lastMidPoint + 180), circleScale1(0), circleScale2(0) ];

    axisLines = gAxis.selectAll('.breakpoint-line')
      .data(ticks, function(d) { return d })
  
    axisLines.exit().remove()

    axisLines.enter()
      .append('g')
      .classed('breakpoint-line', true)
      .append('line')
      .attr('x1', radius - 20)
      .attr('x2', radius)
    .style('stroke-width', '4px')
      .style('stroke', function(d,i) {
        if (i == 0)
          return 'green';
        else if (i == 1)
          return 'red';
        /*
        else if (i == 2)
          return 'lightblue';
        else if (i == 3)
          return 'darkblue';
          */
      })

    svg.selectAll('.breakpoint-line')
      .attr('transform', function(d) { return `rotate(${d})` });
  }

  drawAxis();
}
