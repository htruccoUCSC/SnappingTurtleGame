import { Scene } from "phaser";

export class Game extends Scene {
  constructor() {
    super("Game");
  }

  create() {
    this.cameras.main.setBackgroundColor(0x00ff00);
    // center coords
    this.centerX = this.cameras.main.width / 2;
    this.centerY = this.cameras.main.height / 2;

    // Hint UI: instruct turtle player how to bite (score mechanic removed)
    this.biteHintText = this.add
      .text(16, 16, "Press A to bite", {
        fontFamily: "Arial",
        fontSize: 24,
        color: "#ffffff",
      })
      .setDepth(10);

    // Mouth sprites (open by default)
    this.mouthX = this.centerX;
    this.mouthY = this.centerY;

    this.mouthClosed = this.add
      .sprite(this.mouthX, this.mouthY, "turtle", 0)
      .setScale(8)
      .setOrigin(0.5)
      .setDepth(3)
      .setVisible(false);
    this.mouthOpen = this.add
      .sprite(this.mouthX, this.mouthY, "turtle", 1)
      .setScale(8)
      .setOrigin(0.5)
      .setDepth(2);

    // Scores
    this.leftScore = 0; // Turtle
    this.rightScore = 0; // Slapper/hand
    this.leftScoreText = this.add
      .text(16, 64, "Turtle: 0", {
        fontFamily: "Arial",
        fontSize: 20,
        color: "#ffffff",
      })
      .setDepth(10);
    this.rightScoreText = this.add
      .text(this.cameras.main.width - 16, 64, "Slapper: 0", {
        fontFamily: "Arial",
        fontSize: 20,
        color: "#ffffff",
      })
      .setOrigin(1, 0)
      .setDepth(10);

    // Hand mashing meter (for the slapper). Increases on 'L' presses and decays over time.
    this.handMash = 0;
    this.handMashMax = 100;
    this.handMashInc = 6; // per keydown
    this.handMashDecayRate = 18; // units per second
    this.handMashSlamThreshold = 0.5; // 50% required to K-slam
    // how long the hand should pause on a successful bite before retreat (ms)
    this.bitePauseDuration = 1000; // 1s pause
    // internal event handle for scheduled slam retreat (so we can cancel it on bite)
    this._slamRetreatEvent = null;
    // turtle bite lockout: after a bite completes, prevent biting for this duration (ms)
    this.turtleLockoutDuration = 1500; // 1.5s
    this.turtleLocked = false;
    this._turtleLockEvent = null;

    // Visual bar dimensions and placement (top-right)
    this.handMashBarWidth = 140;
    this.handMashBarHeight = 12;
    const barX = this.cameras.main.width - this.handMashBarWidth / 2 - 20;
    const barY = 24;
    // store for later updates
    this.handMashBarX = barX;
    this.handMashBarY = barY;
    // Background and fill. Fill origin is (0,0.5) so we can resize from the left edge.
    this.handMashBarBg = this.add
      .rectangle(
        barX,
        barY,
        this.handMashBarWidth,
        this.handMashBarHeight,
        0x333333
      )
      .setOrigin(0.5)
      .setDepth(11);
    // Create the fill at full width but use scaleX to control visible amount.
    this.handMashBarFill = this.add
      .rectangle(
        barX - this.handMashBarWidth / 2,
        barY,
        this.handMashBarWidth,
        this.handMashBarHeight,
        0xff4444
      )
      .setOrigin(0, 0.5)
      .setDepth(12);
    this.handMashBarFill.setScale(0, 1);
    // Optional label
    this.add
      .text(barX - this.handMashBarWidth / 2 - 52, barY - 8, "MASH L", {
        fontFamily: "Arial",
        fontSize: 12,
        color: "#ffffff",
      })
      .setDepth(11);
    // Tick mark to indicate slam threshold (50%) placed just below the bar
    const leftX = barX - this.handMashBarWidth / 2;
    const tickX = leftX + this.handMashBarWidth * this.handMashSlamThreshold;
    this.handMashTick = this.add
      .rectangle(tickX, barY + this.handMashBarHeight / 2 + 8, 2, 8, 0xaaaaaa)
      .setOrigin(0.5)
      .setDepth(12);
    this.handSlapHintText = null;
    // Ensure initial bar is drawn
    this.updateMashBar();

    // Hand - start off-screen to the right. Use origin (1,0.5) so scaleX reduces from the right edge inward.
    this.handY =
      this.mouthY + Math.round(this.mouthOpen.displayHeight * 0.18) - 90;
    this.handOffscreenX = this.cameras.main.width + 200;
    // target insertion x will be computed after we know hand scale; default placeholder
    this.handInX = this.mouthX + Math.round(this.mouthOpen.displayWidth * 0.45);

    this.spawnHand();

    // Input handling
    this.isMouthClosed = false;
    this.isBiting = false;
    this.isLKeyPressed = false; // Track L key state to prevent holding

    // Controls: 'A' = turtle (close/open mouth), 'L' = hand (advance/withdraw).
    // Use Phaser's key-specific events for clarity.
    this.input.keyboard.on("keydown-A", () => {
      this.closeMouth();
    });
    this.input.keyboard.on("keyup-A", () => {
      this.openMouth();
    });

    this.input.keyboard.on("keydown-L", () => {
      // Prevent holding L key - only count discrete presses
      if (this.isLKeyPressed) {
        return;
      }
      this.isLKeyPressed = true;

      // Hand player pushes the hand in (mash meter increment)
      // Each keydown-L counts as one mash.
      // Ensure a hand exists so player sees the target.
      if (!this.hand) {
        this.spawnHand();
      }
      // Increase mash value and clamp
      const inc = this.handMashInc || 6;
      this.handMash = Phaser.Math.Clamp(
        this.handMash + inc,
        0,
        this.handMashMax
      );
      // Optional: immediate visual update handled in update(), but update now so UI is responsive
      this.updateMashBar();
    });

    this.input.keyboard.on("keyup-L", () => {
      // Reset L key state when released
      this.isLKeyPressed = false;
    });
    // K key triggers a very fast 'slap' — quick in-and-out of the hand.
    this.input.keyboard.on("keydown-K", () => {
      this.handSlam();
    });
  }

  // Create a new hand and animate it moving into the mouth
  spawnHand() {
    // remove existing hand if present
    if (this.hand) {
      this.hand.destroy();
    }

    this.hand = this.add
      .image(this.handOffscreenX, this.handY, "hand")
      .setOrigin(1, 0.5)
      .setDepth(1);
    this.handRemaining = 1.0; // fraction of hand left

    // Compute a display scale so the (very large) phone photo fits visually when inserted.
    // Make the phone photo hand much smaller so it looks right next to the turtle (was 1696px wide)
    const desiredHandDisplayWidth = 424; // px when handRemaining == 1 (tweakable)
    const textureHandWidth = this.hand.width;
    const desiredHandDispalyHeight = 76;
    const textureHandHeight = this.hand.height;
    this.hand.setScale(
      desiredHandDisplayWidth / textureHandWidth,
      desiredHandDispalyHeight / textureHandHeight
    );

    // Recompute insertion X based on mouth/display sizes
    this.handInX = this.mouthX + Math.round(this.mouthOpen.displayWidth * 0.45);

    // Choose a random maximum insertion depth at spawn time: 33% - 100% of the way from offscreen -> full-in
    const fullInX =
      this.mouthX + Math.round(this.mouthOpen.displayWidth * 0.45);
    const startX = this.handOffscreenX;
    const depthPercent = Phaser.Math.FloatBetween(0.33, 1.0);
    // handInX is a point moved `depthPercent` of the distance from startX to fullInX
    this.handInX = Math.round(startX - depthPercent * (startX - fullInX));

    // Move in a lot slower so the hand lingers during approach
    const approachDur = Phaser.Math.Between(2200, 4000);

    // move hand into the selected target (may be shallow)
  }

  // Update is used to decay the mash meter and refresh visuals.
  update(time, delta) {
    // delta is in ms. Convert to seconds for decay calculations.
    const dt = (delta || 0) / 1000;

    if (this.handMash > 0) {
      // Decay the mash meter over time
      const decay = (this.handMashDecayRate || 18) * dt;
      this.handMash = Phaser.Math.Clamp(
        this.handMash - decay,
        0,
        this.handMashMax
      );
      this.updateMashBar();
    }
  }

  // Redraw the mash bar based on current meter value.
  updateMashBar() {
    if (!this.handMashBarFill || !this.handMashBarBg) {
      return;
    }
    const pct = Phaser.Math.Clamp(this.handMash / this.handMashMax, 0, 1);
    // Use scaleX to adjust visible width reliably for Rectangle objects
    this.handMashBarFill.setScale(pct, 1);
    // Update tick color to indicate readiness. When threshold is met,
    // replace the tick with a big red 'Press K to slap' hint.
    if (this.handMashTick) {
      if (pct >= (this.handMashSlamThreshold || 0.5)) {
        // hide tick and show hint text
        this.handMashTick.setVisible(false);
        if (!this.handSlapHintText) {
          const hintX = this.handMashBarX;
          const hintY = this.handMashBarY + this.handMashBarHeight / 2 + 22;
          this.handSlapHintText = this.add
            .text(hintX, hintY, "Press K to slap", {
              fontFamily: "Arial",
              fontSize: 18,
              color: "#ff2222",
            })
            .setOrigin(0.5)
            .setDepth(13);
        } else {
          this.handSlapHintText.setVisible(true);
        }
      } else {
        // show tick and hide/destroy hint
        this.handMashTick.setVisible(true);
        if (this.handSlapHintText) {
          this.handSlapHintText.destroy();
          this.handSlapHintText = null;
        }
        this.handMashTick.setFillStyle(0xaaaaaa);
      }
    }
  }

  // Perform a very fast in-and-out slam that is hard to react to.
  handSlam() {
    // If already no hand, spawn one so players can see it.
    if (!this.hand) {
      this.spawnHand();
    }

    // Prevent spamming: short cooldown
    if (this._slamCooldown) {
      return;
    }
    // Require mash threshold to perform slam
    const required =
      (this.handMashMax || 100) * (this.handMashSlamThreshold || 0.5);
    if ((this.handMash || 0) < required) {
      // Briefly flash the bar to indicate failure
      if (this.handMashBarFill) {
        this.handMashBarFill.setFillStyle(0xff8888);
        this.time.delayedCall(140, () => {
          this.handMashBarFill.setFillStyle(0xff4444);
        });
      }
      return;
    }

    this._slamCooldown = true;
    this.time.delayedCall(300, () => {
      this._slamCooldown = false;
    });

    // Kill any existing hand tweens so we control the motion.
    if (this.hand) {
      this.tweens.killTweensOf(this.hand);
    }

    // Ensure handInX computed
    if (!this.handInX) {
      this.handInX =
        this.mouthX + Math.round(this.mouthOpen.displayWidth * 0.45);
    }

    // Consume the mash meter (reset to zero) on successful slam
    this.handMash = 0;
    this.updateMashBar();

    const slamInDur = 40; // very fast in (ms)
    const slapPause = 20; // brief window in mouth for possible bite (ms)
    const slamOutDur = 60; // quick retreat

    // Animate in very fast
    this.tweens.add({
      targets: this.hand,
      x: this.handInX,
      duration: slamInDur,
      ease: "Cubic.easeOut",
      onComplete: () => {
        // Small pause to give the turtle a tiny window to bite
        // Store the delayed event so a bite can cancel it and force a longer pause.
        this._slamRetreatEvent = this.time.delayedCall(slapPause, () => {
          // Retreat quickly offscreen. Do NOT trigger the original game-over logic here.
          this.tweens.add({
            targets: this.hand,
            x: this.handOffscreenX,
            duration: slamOutDur,
            ease: "Cubic.easeIn",
            onComplete: () => {
              // If this slam completed without being bitten, award a point to the slapper
              if (!this._biteHandled) {
                this.sound.play('miss');
                this.rightScore = (this.rightScore || 0) + 1;
                if (this.rightScoreText) {
                  this.rightScoreText.setText("Slapper: " + this.rightScore);
                }
              }
              // destroy the hand sprite after the retreat so we can respawn later
              if (this.hand) {
                this.hand.destroy();
                this.hand = null;
              }
              // Clear any scheduled exit events and reset flags
              if (this.exitEvent) {
                this.exitEvent.remove(false);
                this.exitEvent = null;
              }
              // Spawn a fresh hand at the original offscreen starting position
              // so the game returns to a zero state after a slam.
              this.spawnHand();
              // clear stored event
              this._slamRetreatEvent = null;
            },
          });
        });
      },
    });
  }

  closeMouth() {
    // Prevent biting while mouth already closed, during a bite, or during lockout
    if (this.isMouthClosed || this.isBiting || this.turtleLocked) {
      return;
    }
    this.isMouthClosed = true;
    this.mouthOpen.setVisible(false);
    this.mouthClosed.setVisible(true);

    // Single bite: compute how much of the hand is inside the mouth right now.
    // If the player bites before the hand reaches the mouth, that's a score of 0.
    let biteHit = false;
    if (this.hand) {
      const mouthBounds = this.mouthClosed.getBounds();
      const handBounds = this.hand.getBounds();
      const intersection = Phaser.Geom.Intersects.GetRectangleIntersection(
        mouthBounds,
        handBounds
      );
      if (intersection && intersection.width > 0) {
        biteHit = true;
      }
    }

    // Prevent the hand from withdrawing and stop its movement while we're in the bite state
    if (this.exitEvent) {
      this.exitEvent.remove(false);
    }
    if (this.hand) {
      this.hand._exiting = true;
      // stop any tweens moving the hand so it freezes in place
      this.tweens.killTweensOf(this.hand);
    }
    this.isBiting = true;

    if (biteHit) {
      // Show a red flash and briefly tint the hand to indicate a successful bite
      try {
        this.cameras.main.flash(160, 255, 0, 0);
      } catch (e) {}
      if (this.hand) {
        this.hand.setTint(0xff0000);
      }
      this.sound.play('bite');
      // Clear tint shortly after
      this.time.delayedCall(300, () => {
        if (this.hand) {
          this.hand.clearTint();
        }
      });

      // Award a point to the turtle (left side)
      this.leftScore = (this.leftScore || 0) + 1;
      if (this.leftScoreText) {
        this.leftScoreText.setText("Turtle: " + this.leftScore);
      }

      // Stop the hand briefly (it is already frozen due to killed tweens) then retreat and reset
      if (!this._biteHandled) {
        this._biteHandled = true;
        // small pause so the bite 'hangs' visually
        // Cancel any pending slam retreat so we control the full pause duration
        if (this._slamRetreatEvent) {
          this._slamRetreatEvent.remove(false);
          this._slamRetreatEvent = null;
        }
        this.time.delayedCall(this.bitePauseDuration || 600, () => {
          if (!this.hand) {
            this._biteHandled = false;
            return;
          }
          // ensure no tweens are running
          this.tweens.killTweensOf(this.hand);
          // retreat the hand offscreen then respawn a fresh hand
          this.tweens.add({
            targets: this.hand,
            x: this.handOffscreenX,
            duration: 300,
            ease: "Cubic.easeIn",
            onComplete: () => {
              if (this.hand) {
                this.hand.destroy();
                this.hand = null;
              }
              if (this.exitEvent) {
                this.exitEvent.remove(false);
                this.exitEvent = null;
              }
              this.spawnHand();
              this._biteHandled = false;
            },
          });
        });
      }
    }

    // After a short delay, end the bite and reopen the mouth regardless of hit/miss
    this.time.delayedCall(700, () => {
      this.isBiting = false;
      this.openMouth();
      // Begin turtle lockout so the turtle can't immediately bite again while mouth is open
      this.turtleLocked = true;
      // visually indicate lockout by greying out the hint text
      if (this.biteHintText) {
        this.biteHintText.setAlpha(0.45);
      }
      if (this._turtleLockEvent) {
        this._turtleLockEvent.remove(false);
        this._turtleLockEvent = null;
      }
      this._turtleLockEvent = this.time.delayedCall(
        this.turtleLockoutDuration || 1500,
        () => {
          this.turtleLocked = false;
          // restore hint text visibility
          if (this.biteHintText) {
            this.biteHintText.setAlpha(1);
          }
          this._turtleLockEvent = null;
        }
      );
    });
  }

  openMouth() {
    // Ignore open requests while biting is in progress
    if (!this.isMouthClosed || this.isBiting) {
      return;
    }
    this.isMouthClosed = false;
    this.mouthOpen.setVisible(true);
    this.mouthClosed.setVisible(false);
  }
}
