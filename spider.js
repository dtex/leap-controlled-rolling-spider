var RollingSpider = require("rolling-spider");
var Leap = require("leapjs");
var Barcli = require("barcli");

var state = "landed";

var fmap = function(value, fromLow, fromHigh, toLow, toHigh) {
  return constrain(
    (value - fromLow) * (toHigh - toLow) /
      (fromHigh - fromLow) + toLow,
    toLow, toHigh);
};

var gapmap = function(value, lowRange, gap, highRange) {

  var result = gap;

  if (value <= lowRange[1]) {
    result = fmap(value, lowRange[0], lowRange[1], lowRange[2], lowRange[3]);
  }
  if (value >= highRange[0]) {
    result = fmap(value, highRange[0], highRange[1], highRange[2], highRange[3]);
  }

  return constrain(result, lowRange[2], highRange[3]);
};

var spidey = new RollingSpider({logger: function() {}, uuid: "0f17c9cb058049adb6a6b6f617e4d105"});

var heightMeter = new Barcli({label: "Height", range: [-100, 100], precision: 4});
var xMeter = new Barcli({label: "Left/Right", range: [-100, 100], precision: 4});
var zMeter = new Barcli({label: "Forward/Reverse", range: [-100, 100], precision: 4});
var yawMeter = new Barcli({label: "CW/CCW", range: [-100, 100], precision: 4});

var battery = new Barcli({label: "Battery", range: [0, 100], precision: 4});

spidey.connect(function() {

  spidey.setup(function() {

    spidey.flatTrim();
    spidey.startPing();

    Leap.loop({enableGestures: true}, function(frame) {

      var velocity = 0;

      if (frame.hands.length > 0) {
        velocity = frame.hands[0].palmVelocity.reduce(
          function(previous, current) {
            return Math.abs(current) > previous ? current : previous;
          }
        );
      }

      if (frame.hands.length === 1 && velocity < 200) {

        var height = gapmap(frame.hands[0].palmPosition[1], [50, 250, -100, 0], 0, [350, 400, 0, 100]);

        var pitch = gapmap(frame.hands[0].pitch()*-1, [-0.75, -0.5, -100, 0], 0, [0, 0.5, 0, 100]);
        var roll = gapmap(frame.hands[0].roll()*-1, [-0.75, -0.35, -100, 0], 0, [0.35, 0.75, 0, 100]);
        var yaw = gapmap(frame.hands[0].yaw(), [-1.0, -0.2, -100, 0], 0, [0.2, 1, 0, 100]);

        heightMeter.update(height);
        xMeter.update(roll);
        zMeter.update(pitch);
        yawMeter.update(yaw);

        if (state === "landed") {
          spidey.takeOff();
          state = "flying";

        } else {

          //handle height
          if (height < 0) {
            spidey.up({speed: Math.abs(height), steps: 5});
          } else {
            spidey.down({speed: Math.abs(height), steps: 5});
          }

          //handle roll
          if (roll > 0) {
            spidey.left({speed: Math.abs(roll), steps: 1});
          } else {
            spidey.right({speed: Math.abs(roll), steps: 1});
          }

          //handle pitch
          if (pitch > 0) {
            spidey.forward({speed: Math.abs(pitch), steps: 1});
          } else {
            spidey.reverse({speed: Math.abs(pitch), steps: 1});
          }

          //handle yaw
          if (yaw > 0) {
            spidey.turnRight({speed: Math.abs(yaw), steps: 1});
          } else {
            spidey.turnLeft({speed: Math.abs(yaw), steps: 1});
          }
        }

      } else {
        if (frame.hands.length === 0 && state !== "flying") {
          state = "landing";
          spidey.land(function() {
            state = "landed";
          });
        }
      }

    });

  });
});
